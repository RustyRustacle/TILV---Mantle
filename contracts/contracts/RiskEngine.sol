// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RiskEngine
 * @dev On-chain risk validation and tier assignment for TILV platform
 * Integrates with off-chain AI risk scoring oracle
 */
contract RiskEngine is Ownable {
    
    struct RiskAssessment {
        uint256 score;              // Risk score 0-100 (0 = lowest risk)
        uint256 tier;               // 0 = Prime, 1 = Growth, 2 = Emerging
        uint256 timestamp;          // When assessment was made
        address validator;          // Who validated
        bool isValid;              // Whether assessment is still valid
    }

    // Oracle addresses authorized to submit risk scores
    mapping(address => bool) public authorizedOracles;
    
    // Invoice risk assessments: invoiceId => RiskAssessment
    mapping(uint256 => RiskAssessment) public assessments;
    
    // Risk tier thresholds
    uint256 public constant PRIME_MAX_SCORE = 30;
    uint256 public constant GROWTH_MAX_SCORE = 60;
    uint256 public constant EMERGING_MAX_SCORE = 100;

    // Assessment validity period (30 days)
    uint256 public assessmentValidityPeriod = 30 days;

    // Events
    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);
    event RiskAssessed(
        uint256 indexed invoiceId,
        uint256 score,
        uint256 tier,
        address indexed validator
    );
    event AssessmentInvalidated(uint256 indexed invoiceId);

    constructor() {
        // Owner is automatically an authorized oracle
        authorizedOracles[msg.sender] = true;
        emit OracleAuthorized(msg.sender);
    }

    /**
     * @dev Submit risk assessment for an invoice
     * @param invoiceId The invoice NFT ID
     * @param score Risk score from AI engine (0-100)
     */
    function submitRiskAssessment(uint256 invoiceId, uint256 score) 
        external 
        onlyAuthorizedOracle 
    {
        require(score <= 100, "Score must be <= 100");
        
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

    /**
     * @dev Get tier based on risk score
     * @param score The risk score (0-100)
     * @return tier 0 = Prime, 1 = Growth, 2 = Emerging
     */
    function getTierForScore(uint256 score) public pure returns (uint256) {
        if (score <= PRIME_MAX_SCORE) {
            return 0;  // Prime
        } else if (score <= GROWTH_MAX_SCORE) {
            return 1;  // Growth
        } else {
            return 2;  // Emerging
        }
    }

    /**
     * @dev Check if risk assessment is still valid
     * @param invoiceId The invoice NFT ID
     * @return bool Whether assessment is valid
     */
    function isAssessmentValid(uint256 invoiceId) public view returns (bool) {
        RiskAssessment memory assessment = assessments[invoiceId];
        
        if (!assessment.isValid) {
            return false;
        }

        // Check if assessment has expired
        if (block.timestamp > assessment.timestamp + assessmentValidityPeriod) {
            return false;
        }

        return true;
    }

    /**
     * @dev Get risk assessment for an invoice
     * @param invoiceId The invoice NFT ID
     * @return RiskAssessment struct
     */
    function getRiskAssessment(uint256 invoiceId) 
        external 
        view 
        returns (RiskAssessment memory) 
    {
        return assessments[invoiceId];
    }

    /**
     * @dev Invalidate a risk assessment
     * @param invoiceId The invoice NFT ID
     */
    function invalidateAssessment(uint256 invoiceId) external onlyAuthorizedOracle {
        assessments[invoiceId].isValid = false;
        emit AssessmentInvalidated(invoiceId);
    }

    /**
     * @dev Add an authorized oracle
     * @param oracle Address to authorize
     */
    function authorizeOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid address");
        require(!authorizedOracles[oracle], "Already authorized");
        
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /**
     * @dev Revoke oracle authorization
     * @param oracle Address to revoke
     */
    function revokeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Not authorized");
        
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    /**
     * @dev Update assessment validity period
     * @param newPeriod New validity period in seconds
     */
    function setAssessmentValidityPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod > 0, "Period must be > 0");
        assessmentValidityPeriod = newPeriod;
    }

    /**
     * @dev Modifier to check if caller is authorized oracle
     */
    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }
}
