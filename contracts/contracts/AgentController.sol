// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================
//  TILV – AgentController.sol
//  Wires ERC-8004 (Identity / Reputation / Validation) to the
//  existing VaultManager for autonomous yield optimisation.
//
//  Deploy order:
//  1. Deploy this contract (pass registry + vault addresses)
//  2. Call registerAgent(agentURI) once to mint the agent NFT
//  3. Grant AGENT_ROLE on VaultManager to this contract's address
//  4. Start the Python yield_optimizer.py service
// =============================================================

// ---------------------------------------------------------------
// Minimal OpenZeppelin-style interfaces (avoids import headaches
// on testnet; swap for real OZ imports on mainnet)
// ---------------------------------------------------------------
abstract contract Ownable {
    address private _owner;
    event OwnershipTransferred(address indexed prev, address indexed next);
    constructor() { _owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == _owner, "Not owner"); _; }
    function owner() public view returns (address) { return _owner; }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

abstract contract ReentrancyGuard {
    uint256 private _status = 1;
    modifier nonReentrant() { require(_status == 1, "Reentrant"); _status = 2; _; _status = 1; }
}

// ---------------------------------------------------------------
// ERC-8004 Interface – Identity Registry
// Deployed singleton per chain. On Mantle testnet deploy your own
// or use the community-deployed address once available.
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// ERC-8004 Interface – Reputation Registry
// ---------------------------------------------------------------
interface IERC8004Reputation {
    function giveFeedback(
        uint256 agentId,
        int128  value,
        uint8   valueDecimals,
        string  calldata tag1,       // e.g. "tradingYield"
        string  calldata tag2,       // e.g. "week"
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

// ---------------------------------------------------------------
// ERC-8004 Interface – Validation Registry
// ---------------------------------------------------------------
interface IERC8004Validation {
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string  calldata requestURI,
        bytes32 requestHash
    ) external;

    function validationResponse(
        bytes32 requestHash,
        uint8   response,       // 0 = fail, 100 = pass, intermediates allowed
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

// ---------------------------------------------------------------
// TILV – VaultManager interface (existing contract, read-only here)
// ---------------------------------------------------------------
interface IVaultManager {
    // Vault tiers: 0 = Prime, 1 = Growth, 2 = Emerging
    function rebalance(uint8 fromTier, uint8 toTier, uint256 amount) external;
    function getVaultState(uint8 tier)
        external view
        returns (
            uint256 tvl,
            uint256 utilization,   // basis points, e.g. 7500 = 75%
            uint256 currentApy     // basis points, e.g. 600  = 6%
        );
    function getTotalLiquidity() external view returns (uint256);
}

// ---------------------------------------------------------------
// TILV – RiskEngine interface (existing contract)
// ---------------------------------------------------------------
interface IRiskEngine {
    function getAverageRiskScore(uint8 tier) external view returns (uint256); // 0-100
}

// ---------------------------------------------------------------
//  AgentController
// ---------------------------------------------------------------
contract AgentController is Ownable, ReentrancyGuard {

    // ── ERC-8004 registries ────────────────────────────────────
    IERC8004Identity   public identityRegistry;
    IERC8004Reputation public reputationRegistry;
    IERC8004Validation public validationRegistry;

    // ── TILV contracts ─────────────────────────────────────────
    IVaultManager public vaultManager;
    IRiskEngine   public riskEngine;

    // ── Agent state ────────────────────────────────────────────
    uint256 public agentId;           // ERC-721 tokenId after registration
    bool    public agentRegistered;

    // The off-chain Python signer wallet. Only this address can
    // submit proposals. Set once via setAgentSigner().
    address public agentSigner;

    // Pluggable validator contract (can be a simple on-chain
    // rule-checker or a full zkML verifier later)
    address public validatorAddress;

    // ── Safety parameters ──────────────────────────────────────
    uint256 public maxRebalanceBps   = 2000;  // 20% of vault TVL per tx
    uint256 public cooldownPeriod    = 6 hours;
    uint256 public lastRebalanceTime;
    uint256 public validationTimeout = 30 minutes;
    bool    public paused;

    // ── Proposal lifecycle ─────────────────────────────────────
    enum ProposalStatus { Pending, Validated, Executed, Rejected, Expired }

    struct Proposal {
        uint8          fromTier;
        uint8          toTier;
        uint256        amount;
        bytes32        requestHash;
        uint256        submittedAt;
        ProposalStatus status;
        int128         yieldDeltaBps;   // filled after execution
    }

    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public proposalHistory;   // ordered log for off-chain indexing

    // ── Events ─────────────────────────────────────────────────
    event AgentRegistered(uint256 indexed agentId, string agentURI);
    event ProposalSubmitted(bytes32 indexed requestHash, uint8 fromTier, uint8 toTier, uint256 amount);
    event ProposalExecuted(bytes32 indexed requestHash, uint8 fromTier, uint8 toTier, uint256 amount, int128 yieldDelta);
    event ProposalRejected(bytes32 indexed requestHash, string reason);
    event ReputationWritten(uint256 indexed agentId, int128 yieldDelta, string period);
    event EmergencyPause(address indexed by);
    event EmergencyUnpause(address indexed by);

    // ── Modifiers ──────────────────────────────────────────────
    modifier onlySigner() {
        require(msg.sender == agentSigner, "AC: not agent signer");
        _;
    }

    modifier notPaused() {
        require(!paused, "AC: paused");
        _;
    }

    modifier agentReady() {
        require(agentRegistered, "AC: agent not registered");
        _;
    }

    // ── Constructor ────────────────────────────────────────────
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry,
        address _vaultManager,
        address _riskEngine,
        address _validatorAddress,
        address _agentSigner
    ) {
        identityRegistry   = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        validationRegistry = IERC8004Validation(_validationRegistry);
        vaultManager       = IVaultManager(_vaultManager);
        riskEngine         = IRiskEngine(_riskEngine);
        validatorAddress   = _validatorAddress;
        agentSigner        = _agentSigner;
    }

    // ── Step 1: Register the agent once ───────────────────────
    // agentURI should point to agent_registration.json on IPFS
    function registerAgent(string calldata agentURI) external onlyOwner {
        require(!agentRegistered, "AC: already registered");
        agentId        = identityRegistry.register(agentURI);
        agentRegistered = true;
        emit AgentRegistered(agentId, agentURI);
    }

    // ── Step 2: Agent submits a rebalancing proposal ───────────
    // Called by Python yield_optimizer.py via signed tx.
    // requestHash = keccak256(abi.encode(fromTier, toTier, amount, block.number))
    // requestURI  = IPFS link to the full reasoning JSON
    function submitProposal(
        uint8   fromTier,
        uint8   toTier,
        uint256 amount,
        string  calldata requestURI,
        bytes32 requestHash
    ) external onlySigner notPaused agentReady nonReentrant {
        require(fromTier < 3 && toTier < 3, "AC: invalid tier");
        require(fromTier != toTier,          "AC: same tier");
        require(amount > 0,                  "AC: zero amount");
        require(proposals[requestHash].submittedAt == 0, "AC: duplicate hash");

        // Guard: amount must not exceed maxRebalanceBps of total liquidity
        uint256 totalLiq = vaultManager.getTotalLiquidity();
        require(
            amount <= (totalLiq * maxRebalanceBps) / 10000,
            "AC: exceeds max rebalance"
        );

        // Cooldown check
        require(
            block.timestamp >= lastRebalanceTime + cooldownPeriod,
            "AC: cooldown active"
        );

        // Store proposal
        proposals[requestHash] = Proposal({
            fromTier:      fromTier,
            toTier:        toTier,
            amount:        amount,
            requestHash:   requestHash,
            submittedAt:   block.timestamp,
            status:        ProposalStatus.Pending,
            yieldDeltaBps: 0
        });
        proposalHistory.push(requestHash);

        // Fire validation request to ERC-8004 Validation Registry
        validationRegistry.validationRequest(
            validatorAddress,
            agentId,
            requestURI,
            requestHash
        );

        emit ProposalSubmitted(requestHash, fromTier, toTier, amount);
    }

    // ── Step 3: Execute a validated proposal ──────────────────
    // Anyone can call this after validation passes. The Python
    // agent calls it automatically once it sees the validation
    // response on-chain.
    function executeProposal(bytes32 requestHash)
        external
        notPaused
        agentReady
        nonReentrant
    {
        Proposal storage p = proposals[requestHash];
        require(p.submittedAt > 0,                       "AC: unknown proposal");
        require(p.status == ProposalStatus.Pending,      "AC: not pending");
        require(
            block.timestamp <= p.submittedAt + validationTimeout,
            "AC: proposal expired"
        );

        // Read validation result from ERC-8004
        (
            ,           // validatorAddress (already known)
            ,           // agentId (already known)
            uint8 resp,
            ,           // responseHash
            ,           // tag
                        // lastUpdate
        ) = validationRegistry.getValidationStatus(requestHash);

        require(resp >= 70, "AC: validation failed"); // 70+ = pass threshold

        p.status = ProposalStatus.Validated;

        // Snapshot APY before rebalance for yield delta calculation
        (, , uint256 apyBefore) = vaultManager.getVaultState(p.toTier);

        // Execute on VaultManager
        vaultManager.rebalance(p.fromTier, p.toTier, p.amount);

        // Snapshot APY after
        (, , uint256 apyAfter) = vaultManager.getVaultState(p.toTier);

        int128 delta = int128(int256(apyAfter)) - int128(int256(apyBefore));
        p.yieldDeltaBps   = delta;
        p.status          = ProposalStatus.Executed;
        lastRebalanceTime = block.timestamp;

        emit ProposalExecuted(requestHash, p.fromTier, p.toTier, p.amount, delta);

        // Write reputation feedback to ERC-8004 Reputation Registry
        _writeReputation(delta);
    }

    // ── Step 4 (internal): Write outcome to Reputation Registry ─
    function _writeReputation(int128 yieldDeltaBps) internal {
        // value = yield delta in basis points
        // tag1  = "tradingYield" (matches ERC-8004 spec example)
        // tag2  = "week" (rolling window tracked off-chain)
        reputationRegistry.giveFeedback(
            agentId,
            yieldDeltaBps,
            2,                  // valueDecimals: bps already at 2dp vs %
            "tradingYield",
            "week",
            "",                 // endpoint: leave blank, tracked off-chain
            "",                 // feedbackURI: no IPFS file for now
            bytes32(0)
        );

        emit ReputationWritten(agentId, yieldDeltaBps, "week");
    }

    // ── Read helpers ──────────────────────────────────────────

    // Returns current vault snapshot (used by Python agent)
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

    function getProposalCount() external view returns (uint256) {
        return proposalHistory.length;
    }

    // ── Admin ─────────────────────────────────────────────────

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
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpause(msg.sender);
    }
}
