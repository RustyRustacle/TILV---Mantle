// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./InvoiceNFT.sol";

contract VaultManager is Ownable, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    enum VaultTier {
        PRIME,
        GROWTH,
        EMERGING
    }

    struct Vault {
        VaultTier tier;
        uint256 totalDeposits;
        uint256 totalAllocated;
        uint256 totalReturns;
        uint256 minDeposit;
        uint256 maxRiskScore;
        uint256 advanceRate;
        bool isActive;
    }

    struct InvestorPosition {
        uint256 depositedAmount;
        uint256 shares;
        uint256 depositTimestamp;
        uint256 claimedReturns;
    }

    IERC20 public stablecoin;
    InvoiceNFT public invoiceNFT;

    mapping(VaultTier => Vault) public vaults;
    mapping(VaultTier => mapping(address => InvestorPosition)) public positions;
    mapping(uint256 => VaultTier) public invoiceAllocations;
    mapping(uint256 => uint256) public invoiceFunding;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PLATFORM_FEE = 200;

    bool public paused;

    event VaultDeposit(address indexed investor, VaultTier tier, uint256 amount, uint256 shares);
    event VaultWithdrawal(address indexed investor, VaultTier tier, uint256 amount, uint256 shares);
    event InvoiceFunded(uint256 indexed invoiceId, VaultTier tier, uint256 amount);
    event InvoiceRepaid(uint256 indexed invoiceId, uint256 amount, uint256 yield);
    event YieldDistributed(VaultTier tier, uint256 totalYield);
    event VaultRebalanced(uint8 fromTier, uint8 toTier, uint256 amount);
    event EmergencyPause(address indexed by);
    event EmergencyUnpause(address indexed by);

    modifier notPaused() {
        require(!paused, "VM: paused");
        _;
    }

    constructor(address _stablecoin, address _invoiceNFT) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(_invoiceNFT != address(0), "Invalid invoiceNFT address");

        stablecoin = IERC20(_stablecoin);
        invoiceNFT = InvoiceNFT(_invoiceNFT);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        vaults[VaultTier.PRIME] = Vault({
            tier: VaultTier.PRIME,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 1000 * 10**6,
            maxRiskScore: 30,
            advanceRate: 8000,
            isActive: true
        });

        vaults[VaultTier.GROWTH] = Vault({
            tier: VaultTier.GROWTH,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 500 * 10**6,
            maxRiskScore: 60,
            advanceRate: 7500,
            isActive: true
        });

        vaults[VaultTier.EMERGING] = Vault({
            tier: VaultTier.EMERGING,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 100 * 10**6,
            maxRiskScore: 100,
            advanceRate: 7000,
            isActive: true
        });
    }

    function deposit(VaultTier tier, uint256 amount) external nonReentrant notPaused {
        Vault storage vault = vaults[tier];
        require(vault.isActive, "Vault is not active");
        require(amount >= vault.minDeposit, "Amount below minimum deposit");

        InvestorPosition storage position = positions[tier][msg.sender];

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        uint256 totalShares = getTotalShares(tier);
        uint256 shares;
        if (totalShares == 0 || vault.totalDeposits == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / vault.totalDeposits;
        }

        position.depositedAmount += amount;
        position.shares += shares;
        if (position.depositTimestamp == 0) {
            position.depositTimestamp = block.timestamp;
        }

        vault.totalDeposits += amount;

        emit VaultDeposit(msg.sender, tier, amount, shares);
    }

    function withdraw(VaultTier tier, uint256 shares) external nonReentrant notPaused {
        Vault storage vault = vaults[tier];
        InvestorPosition storage position = positions[tier][msg.sender];

        require(position.shares >= shares, "Insufficient shares");
        require(getAvailableLiquidity(tier) >= (shares * getTotalValue(tier)) / getTotalShares(tier), "Insufficient liquidity");

        uint256 totalValue = getTotalValue(tier);
        uint256 totalShares = getTotalShares(tier);
        uint256 withdrawAmount = (shares * totalValue) / totalShares;

        if (shares == position.shares) {
            position.depositedAmount = 0;
        } else {
            position.depositedAmount = (position.depositedAmount * (position.shares - shares)) / position.shares;
        }
        position.shares -= shares;

        vault.totalDeposits -= withdrawAmount;

        stablecoin.safeTransfer(msg.sender, withdrawAmount);

        emit VaultWithdrawal(msg.sender, tier, withdrawAmount, shares);
    }

    function fundInvoice(uint256 invoiceId) external onlyOwner nonReentrant notPaused {
        InvoiceNFT.Invoice memory invoice = invoiceNFT.getInvoice(invoiceId);

        require(
            invoice.status == InvoiceNFT.InvoiceStatus.VALIDATED,
            "Invoice must be validated"
        );

        VaultTier tier = getVaultTierForRisk(invoice.riskScore);
        Vault storage vault = vaults[tier];

        require(vault.isActive, "Vault is not active");
        require(invoice.riskScore <= vault.maxRiskScore, "Risk score too high for vault");

        uint256 fundingAmount = (invoice.amount * vault.advanceRate) / BASIS_POINTS;

        require(
            getAvailableLiquidity(tier) >= fundingAmount,
            "Insufficient vault liquidity"
        );

        vault.totalAllocated += fundingAmount;
        invoiceAllocations[invoiceId] = tier;
        invoiceFunding[invoiceId] = fundingAmount;

        stablecoin.safeTransfer(invoice.borrower, fundingAmount);

        invoiceNFT.markAsFunded(invoiceId, fundingAmount);

        emit InvoiceFunded(invoiceId, tier, fundingAmount);
    }

    function processRepayment(uint256 invoiceId, uint256 repaymentAmount)
        external
        onlyOwner
        nonReentrant
        notPaused
    {
        InvoiceNFT.Invoice memory invoice = invoiceNFT.getInvoice(invoiceId);
        require(
            invoice.status == InvoiceNFT.InvoiceStatus.FUNDED,
            "Invoice not in funded status"
        );

        VaultTier tier = invoiceAllocations[invoiceId];
        Vault storage vault = vaults[tier];
        uint256 fundedAmount = invoiceFunding[invoiceId];

        stablecoin.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        uint256 platformFee = (repaymentAmount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 vaultReturn = repaymentAmount - platformFee;

        uint256 yield = vaultReturn > fundedAmount ? vaultReturn - fundedAmount : 0;

        vault.totalAllocated -= fundedAmount;
        vault.totalReturns += yield;
        vault.totalDeposits += yield;

        invoiceNFT.markAsPaid(invoiceId, repaymentAmount);

        if (platformFee > 0) {
            stablecoin.safeTransfer(owner(), platformFee);
        }

        emit InvoiceRepaid(invoiceId, repaymentAmount, yield);
        emit YieldDistributed(tier, yield);
    }

    function processDefault(uint256 invoiceId)
        external
        onlyOwner
        nonReentrant
        notPaused
    {
        InvoiceNFT.Invoice memory invoice = invoiceNFT.getInvoice(invoiceId);
        require(
            invoice.status == InvoiceNFT.InvoiceStatus.DEFAULTED,
            "Invoice not defaulted"
        );

        VaultTier tier = invoiceAllocations[invoiceId];
        Vault storage vault = vaults[tier];
        uint256 fundedAmount = invoiceFunding[invoiceId];

        vault.totalAllocated -= fundedAmount;

        delete invoiceAllocations[invoiceId];
        delete invoiceFunding[invoiceId];
    }

    function rebalance(uint8 fromTier, uint8 toTier, uint256 amount)
        external
        onlyRole(AGENT_ROLE)
        nonReentrant
        notPaused
    {
        require(fromTier < 3 && toTier < 3, "VM: invalid tier");
        require(fromTier != toTier, "VM: same tier");
        require(amount > 0, "VM: zero amount");

        Vault storage fromVault = vaults[VaultTier(fromTier)];
        Vault storage toVault = vaults[VaultTier(toTier)];

        require(fromVault.isActive && toVault.isActive, "VM: vault not active");
        require(getAvailableLiquidity(VaultTier(fromTier)) >= amount, "VM: insufficient liquidity");
        require(
            toVault.totalDeposits + amount <= type(uint256).max - toVault.totalAllocated,
            "VM: overflow"
        );

        fromVault.totalAllocated += amount;
        toVault.totalDeposits += amount;

        emit VaultRebalanced(fromTier, toTier, amount);
    }

    function getVaultTierForRisk(uint256 riskScore) public pure returns (VaultTier) {
        if (riskScore <= 30) {
            return VaultTier.PRIME;
        } else if (riskScore <= 60) {
            return VaultTier.GROWTH;
        } else {
            return VaultTier.EMERGING;
        }
    }

    function getTotalShares(VaultTier tier) public view returns (uint256) {
        return vaults[tier].totalDeposits;
    }

    function getTotalValue(VaultTier tier) public view returns (uint256) {
        Vault memory vault = vaults[tier];
        return vault.totalDeposits + vault.totalReturns - vault.totalAllocated;
    }

    function getPosition(VaultTier tier, address investor)
        external
        view
        returns (InvestorPosition memory)
    {
        return positions[tier][investor];
    }

    function getAvailableLiquidity(VaultTier tier) public view returns (uint256) {
        Vault memory vault = vaults[tier];
        return vault.totalDeposits - vault.totalAllocated;
    }

    function getVault(VaultTier tier) external view returns (Vault memory) {
        return vaults[tier];
    }

    function getVaultState(uint8 tier)
        external
        view
        returns (
            uint256 tvl,
            uint256 utilization,
            uint256 currentApy
        )
    {
        Vault memory vault = vaults[VaultTier(tier)];
        tvl = vault.totalDeposits;
        if (tvl > 0) {
            utilization = (vault.totalAllocated * BASIS_POINTS) / tvl;
        }
        if (vault.totalDeposits > 0 && vault.totalReturns > 0) {
            currentApy = (vault.totalReturns * BASIS_POINTS) / vault.totalDeposits;
        }
    }

    function getTotalLiquidity() external view returns (uint256) {
        uint256 total;
        for (uint8 i = 0; i < 3; i++) {
            total += vaults[VaultTier(i)].totalDeposits;
        }
        return total;
    }

    function updateVaultParameters(
        VaultTier tier,
        uint256 minDeposit,
        uint256 maxRiskScore,
        uint256 advanceRate
    ) external onlyOwner {
        require(maxRiskScore <= 100, "Risk score must be <= 100");
        require(advanceRate <= BASIS_POINTS, "Advance rate must be <= 100%");

        Vault storage vault = vaults[tier];
        vault.minDeposit = minDeposit;
        vault.maxRiskScore = maxRiskScore;
        vault.advanceRate = advanceRate;
    }

    function setVaultActive(VaultTier tier, bool active) external onlyOwner {
        vaults[tier].isActive = active;
    }

    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpause(msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
