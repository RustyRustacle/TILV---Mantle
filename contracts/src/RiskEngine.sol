// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract RiskEngine is Ownable {

    struct RiskAssessment {
        uint256 score;
        uint256 tier;
        uint256 timestamp;
        address validator;
        bool isValid;
    }

    mapping(address => bool) public authorizedOracles;

    mapping(uint256 => RiskAssessment) public assessments;

    uint256 public constant PRIME_MAX_SCORE = 30;
    uint256 public constant GROWTH_MAX_SCORE = 60;
    uint256 public constant EMERGING_MAX_SCORE = 100;

    uint256 public assessmentValidityPeriod = 30 days;

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);
    event RiskAssessed(
        uint256 indexed invoiceId,
        uint256 score,
        uint256 tier,
        address indexed validator
    );
    event AssessmentInvalidated(uint256 indexed invoiceId);

    constructor() Ownable(msg.sender) {
        authorizedOracles[msg.sender] = true;
        emit OracleAuthorized(msg.sender);
    }

    function submitRiskAssessment(uint256 invoiceId, uint256 score)
        external
        onlyAuthorizedOracle
    {
        require(score <= 100, "Score must be <= 100");
        require(!assessments[invoiceId].isValid, "Assessment already exists");

        uint256 tier = getTierForScore(score);

        assessments[invoiceId] = RiskAssessment({
            score: score,
            tier: tier,
            timestamp: block.timestamp,
            validator: msg.sender,
            isValid: true
        });

        emit RiskAssessed(invoiceId, score, tier, msg.sender);
    }

    function getTierForScore(uint256 score) public pure returns (uint256) {
        if (score <= PRIME_MAX_SCORE) {
            return 0;
        } else if (score <= GROWTH_MAX_SCORE) {
            return 1;
        } else {
            return 2;
        }
    }

    function isAssessmentValid(uint256 invoiceId) public view returns (bool) {
        RiskAssessment memory assessment = assessments[invoiceId];

        if (!assessment.isValid) {
            return false;
        }

        if (block.timestamp > assessment.timestamp + assessmentValidityPeriod) {
            return false;
        }

        return true;
    }

    function getRiskAssessment(uint256 invoiceId)
        external
        view
        returns (RiskAssessment memory)
    {
        return assessments[invoiceId];
    }

    function getAverageRiskScore(uint8 tier) external view returns (uint256) {
        return 0;
    }

    function invalidateAssessment(uint256 invoiceId) external onlyAuthorizedOracle {
        assessments[invoiceId].isValid = false;
        emit AssessmentInvalidated(invoiceId);
    }

    function authorizeOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid address");
        require(!authorizedOracles[oracle], "Already authorized");

        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    function revokeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Not authorized");

        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    function setAssessmentValidityPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod > 0, "Period must be > 0");
        assessmentValidityPeriod = newPeriod;
    }

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }
}
