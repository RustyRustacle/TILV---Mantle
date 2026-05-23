// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC8004Identity {
    struct MetadataEntry {
        string metadataKey;
        bytes  metadataValue;
    }

    function register(string calldata agentURI) external returns (uint256 agentId);
    function setAgentURI(uint256 agentId, string calldata newURI) external;
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes  calldata signature
    ) external;
    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory);
    function setMetadata(uint256 agentId, string memory key, bytes memory value) external;
}

interface IERC8004Reputation {
    function giveFeedback(
        uint256 agentId,
        int128  value,
        uint8   valueDecimals,
        string  calldata tag1,
        string  calldata tag2,
        string  calldata endpoint,
        string  calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256   agentId,
        address[] calldata clientAddresses,
        string    memory tag1,
        string    memory tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}

interface IERC8004Validation {
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string  calldata requestURI,
        bytes32 requestHash
    ) external;

    function validationResponse(
        bytes32 requestHash,
        uint8   response,
        string  calldata responseURI,
        bytes32 responseHash,
        string  calldata tag
    ) external;

    function getValidationStatus(bytes32 requestHash)
        external view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8   response,
            bytes32 responseHash,
            string  memory tag,
            uint256 lastUpdate
        );
}

interface IVaultManager {
    function rebalance(uint8 fromTier, uint8 toTier, uint256 amount) external;
    function reverseRebalance(uint256 loanIndex) external;
    function getVaultState(uint8 tier) external view returns (uint256 tvl, uint256 utilization, uint256 currentApy);
    function getTotalLiquidity() external view returns (uint256);
    function paused() external view returns (bool);
}

interface IRiskEngine {
    function getAverageRiskScore(uint8 tier) external view returns (uint256);
}

contract AgentController is Ownable, ReentrancyGuard {

    IERC8004Identity   public identityRegistry;
    IERC8004Reputation public reputationRegistry;
    IERC8004Validation public validationRegistry;

    IVaultManager public vaultManager;
    IRiskEngine   public riskEngine;

    uint256 public agentId;
    bool    public agentRegistered;

    address public agentSigner;
    address public validatorAddress;

    uint256 public maxRebalanceBps   = 2000;
    uint256 public cooldownPeriod    = 6 hours;
    uint256 public lastRebalanceTime;
    uint256 public validationTimeout = 30 minutes;
    bool    public paused;

    enum ProposalStatus { Pending, Validated, Executed, Rejected, Expired }

    struct Proposal {
        uint8          fromTier;
        uint8          toTier;
        uint256        amount;
        bytes32        requestHash;
        uint256        submittedAt;
        ProposalStatus status;
        int128         yieldDeltaBps;
    }

    mapping(bytes32 => Proposal) public proposals;
    uint256 public proposalCount;

    event AgentRegistered(uint256 indexed agentId, string agentURI);
    event ProposalSubmitted(bytes32 indexed requestHash, uint8 fromTier, uint8 toTier, uint256 amount);
    event ProposalExecuted(bytes32 indexed requestHash, uint8 fromTier, uint8 toTier, uint256 amount, int128 yieldDelta);
    event ProposalRejected(bytes32 indexed requestHash, string reason);
    event ReputationWritten(uint256 indexed agentId, int128 yieldDelta, string period);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    modifier onlySigner() {
        require(msg.sender == agentSigner, "AC: not agent signer");
        _;
    }

    modifier notPaused() {
        require(!paused, "AC: paused");
        _;
    }

    modifier onlyWhenNotShutdown() {
        require(!vaultManager.paused(), "AC: protocol shutdown");
        _;
    }

    modifier agentReady() {
        require(agentRegistered, "AC: agent not registered");
        _;
    }

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry,
        address _vaultManager,
        address _riskEngine,
        address _validatorAddress,
        address _agentSigner
    ) Ownable() {
        require(_identityRegistry != address(0), "AC: zero identity");
        require(_reputationRegistry != address(0), "AC: zero reputation");
        require(_validationRegistry != address(0), "AC: zero validation");
        require(_vaultManager != address(0), "AC: zero vaultManager");
        require(_riskEngine != address(0), "AC: zero riskEngine");
        require(_validatorAddress != address(0), "AC: zero validator");
        require(_agentSigner != address(0), "AC: zero signer");

        identityRegistry   = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        validationRegistry = IERC8004Validation(_validationRegistry);
        vaultManager       = IVaultManager(_vaultManager);
        riskEngine         = IRiskEngine(_riskEngine);
        validatorAddress   = _validatorAddress;
        agentSigner        = _agentSigner;
    }

    function registerAgent(string calldata agentURI) external onlyOwner {
        require(!agentRegistered, "AC: already registered");
        agentId = identityRegistry.register(agentURI);
        agentRegistered = true;
        emit AgentRegistered(agentId, agentURI);
    }

    function submitProposal(
        uint8   fromTier,
        uint8   toTier,
        uint256 amount,
        uint256 nonce,
        string  calldata requestURI,
        bytes32 requestHash
    ) external onlySigner notPaused onlyWhenNotShutdown agentReady nonReentrant {
        require(fromTier < 3 && toTier < 3, "AC: invalid tier");
        require(fromTier != toTier, "AC: same tier");
        require(amount > 0, "AC: zero amount");
        require(proposals[requestHash].submittedAt == 0, "AC: duplicate hash");

        bytes32 computedHash = keccak256(abi.encode(fromTier, toTier, amount, nonce, msg.sender));
        require(requestHash == computedHash, "AC: invalid hash");

        uint256 totalLiq = vaultManager.getTotalLiquidity();
        require(
            amount <= (totalLiq * maxRebalanceBps) / 10000,
            "AC: exceeds max rebalance"
        );

        require(
            block.timestamp >= lastRebalanceTime + cooldownPeriod,
            "AC: cooldown active"
        );

        proposals[requestHash] = Proposal({
            fromTier:      fromTier,
            toTier:        toTier,
            amount:        amount,
            requestHash:   requestHash,
            submittedAt:   block.timestamp,
            status:        ProposalStatus.Pending,
            yieldDeltaBps: 0
        });
        proposalCount++;

        validationRegistry.validationRequest(
            validatorAddress,
            agentId,
            requestURI,
            requestHash
        );

        emit ProposalSubmitted(requestHash, fromTier, toTier, amount);
    }

    function executeProposal(bytes32 requestHash)
        external notPaused onlyWhenNotShutdown agentReady nonReentrant
    {
        Proposal storage p = proposals[requestHash];
        require(p.submittedAt > 0, "AC: unknown proposal");
        require(p.status == ProposalStatus.Pending, "AC: not pending");
        require(
            block.timestamp <= p.submittedAt + validationTimeout,
            "AC: proposal expired"
        );

        (
            ,
            ,
            uint8 resp,
            ,
            ,

        ) = validationRegistry.getValidationStatus(requestHash);

        require(resp >= 70, "AC: validation failed");

        p.status = ProposalStatus.Validated;

        (, , uint256 apyBefore) = vaultManager.getVaultState(p.toTier);

        vaultManager.rebalance(p.fromTier, p.toTier, p.amount);

        (, , uint256 apyAfter) = vaultManager.getVaultState(p.toTier);

        int128 delta = int128(int256(apyAfter)) - int128(int256(apyBefore));
        p.yieldDeltaBps   = delta;
        p.status          = ProposalStatus.Executed;
        lastRebalanceTime = block.timestamp;

        emit ProposalExecuted(requestHash, p.fromTier, p.toTier, p.amount, delta);

        _writeReputation(delta);
    }

    function _writeReputation(int128 yieldDeltaBps) internal {
        reputationRegistry.giveFeedback(
            agentId,
            yieldDeltaBps,
            2,
            "tradingYield",
            "week",
            "",
            "",
            bytes32(0)
        );

        emit ReputationWritten(agentId, yieldDeltaBps, "week");
    }

    function getVaultSnapshot()
        external view
        returns (
            uint256[3] memory tvls,
            uint256[3] memory utilizations,
            uint256[3] memory apys,
            uint256[3] memory riskScores
        )
    {
        for (uint8 i = 0; i < 3; i++) {
            (tvls[i], utilizations[i], apys[i]) = vaultManager.getVaultState(i);
            riskScores[i] = riskEngine.getAverageRiskScore(i);
        }
    }

    function setAgentSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "AC: zero address");
        agentSigner = _signer;
    }

    function setValidatorAddress(address _validator) external onlyOwner {
        require(_validator != address(0), "AC: zero address");
        validatorAddress = _validator;
    }

    function setMaxRebalanceBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "AC: max 50%");
        maxRebalanceBps = bps;
    }

    function setCooldown(uint256 seconds_) external onlyOwner {
        cooldownPeriod = seconds_;
    }

    function updateAgentURI(string calldata newURI) external onlyOwner agentReady {
        identityRegistry.setAgentURI(agentId, newURI);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function renounceOwnership() public override onlyOwner {
        revert("AC: cannot renounce ownership");
    }
}
