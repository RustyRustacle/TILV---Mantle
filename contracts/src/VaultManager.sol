// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./InvoiceNFT.sol";
import "./EmergencyPause.sol";

contract VaultManager is EmergencyPause, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    enum VaultTier { PRIME, GROWTH, EMERGING }

    struct Vault {
        VaultTier tier;
        uint256 totalDeposits;
        uint256 totalAllocated;
        uint256 totalReturns;
        uint256 totalBadDebt;
        uint256 minDeposit;
        uint256 maxRiskScore;
        uint256 advanceRate;
        uint256 createdAt;
        bool isActive;
    }

    struct InvestorPosition {
        uint256 depositedAmount;
        uint256 shares;
        uint256 depositTimestamp;
        uint256 claimedReturns;
    }

    struct CrossVaultLoan {
        uint8 fromTier;
        uint8 toTier;
        uint256 amount;
        uint256 timestamp;
        bool active;
    }

    IERC20 public stablecoin;
    InvoiceNFT public invoiceNFT;
    address public feeCollector;

    mapping(VaultTier => Vault) public vaults;
    mapping(VaultTier => mapping(address => InvestorPosition)) public positions;
    mapping(uint256 => VaultTier) public invoiceAllocations;
    mapping(uint256 => uint256) public invoiceFunding;

    CrossVaultLoan[] public rebalanceLoans;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PLATFORM_FEE = 200;

    event VaultDeposit(address indexed investor, VaultTier tier, uint256 amount, uint256 shares);
    event VaultWithdrawal(address indexed investor, VaultTier tier, uint256 amount, uint256 shares, uint256 returnedYield);
    event InvoiceFunded(uint256 indexed invoiceId, VaultTier tier, uint256 amount);
    event InvoiceRepaid(uint256 indexed invoiceId, uint256 amount, uint256 yield);
    event InvoiceDefaulted(uint256 indexed invoiceId, uint256 loss);
    event YieldDistributed(VaultTier tier, uint256 totalYield);
    event VaultRebalanced(uint8 fromTier, uint8 toTier, uint256 amount, uint256 loanIndex);
    event RebalanceReversed(uint8 fromTier, uint8 toTier, uint256 amount, uint256 loanIndex);
    event BadDebtWrittenOff(VaultTier tier, uint256 amount);

    constructor(address _stablecoin, address _invoiceNFT) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(_invoiceNFT != address(0), "Invalid invoiceNFT address");

        stablecoin = IERC20(_stablecoin);
        invoiceNFT = InvoiceNFT(_invoiceNFT);
        feeCollector = msg.sender;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UNPAUSER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ADMIN_ROLE, msg.sender);

        uint256 now_ = block.timestamp;

        vaults[VaultTier.PRIME] = Vault({
            tier: VaultTier.PRIME,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            totalBadDebt: 0,
            minDeposit: 1000 * 10**6,
            maxRiskScore: 30,
            advanceRate: 8000,
            createdAt: now_,
            isActive: true
        });

        vaults[VaultTier.GROWTH] = Vault({
            tier: VaultTier.GROWTH,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            totalBadDebt: 0,
            minDeposit: 500 * 10**6,
            maxRiskScore: 60,
            advanceRate: 7500,
            createdAt: now_,
            isActive: true
        });

        vaults[VaultTier.EMERGING] = Vault({
            tier: VaultTier.EMERGING,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            totalBadDebt: 0,
            minDeposit: 100 * 10**6,
            maxRiskScore: 100,
            advanceRate: 7000,
            createdAt: now_,
            isActive: true
        });
    }

    function deposit(VaultTier tier, uint256 amount, uint256 minShares) external nonReentrant whenNotPaused whenNotShutdown {
        Vault storage vault = vaults[tier];
        require(vault.isActive, "VM: vault not active");
        require(amount >= vault.minDeposit, "VM: below minimum deposit");

        InvestorPosition storage pos = positions[tier][msg.sender];

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        uint256 totalShares = getTotalShares(tier);
        uint256 totalValue = getTotalValue(tier);
        uint256 shares;
        if (totalShares == 0 || totalValue == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / totalValue;
        }

        require(shares >= minShares, "VM: slippage too high");

        pos.depositedAmount += amount;
        pos.shares += shares;
        if (pos.depositTimestamp == 0) {
            pos.depositTimestamp = block.timestamp;
        }

        vault.totalDeposits += amount;

        emit VaultDeposit(msg.sender, tier, amount, shares);
    }

    function withdraw(VaultTier tier, uint256 shares, uint256 minAmountOut) external nonReentrant whenNotPaused whenNotShutdown {
        Vault storage vault = vaults[tier];
        InvestorPosition storage pos = positions[tier][msg.sender];

        require(pos.shares >= shares, "VM: insufficient shares");

        uint256 totalShares = getTotalShares(tier);
        uint256 totalValue = getTotalValue(tier);
        uint256 withdrawAmount = (shares * totalValue) / totalShares;

        require(withdrawAmount >= minAmountOut, "VM: slippage too high");

        uint256 availLiquidity = getAvailableLiquidity(tier);
        require(withdrawAmount <= availLiquidity, "VM: insufficient liquidity");

        uint256 originalDeposit = pos.depositedAmount;
        uint256 principalPortion;
        uint256 yieldPortion = 0;

        if (shares == pos.shares) {
            principalPortion = originalDeposit;
            pos.depositedAmount = 0;
        } else {
            principalPortion = (originalDeposit * shares) / pos.shares;
            pos.depositedAmount = originalDeposit - principalPortion;
        }

        if (withdrawAmount > principalPortion) {
            yieldPortion = withdrawAmount - principalPortion;
        }

        pos.shares -= shares;

        vault.totalDeposits -= principalPortion;
        if (yieldPortion > 0 && vault.totalReturns >= yieldPortion) {
            vault.totalReturns -= yieldPortion;
        }
        pos.claimedReturns += yieldPortion;

        if (vault.totalBadDebt > 0 && totalShares > 0) {
            uint256 badDebtPortion = (vault.totalBadDebt * shares) / totalShares;
            vault.totalBadDebt -= badDebtPortion;
        }

        stablecoin.safeTransfer(msg.sender, withdrawAmount);

        emit VaultWithdrawal(msg.sender, tier, withdrawAmount, shares, yieldPortion);
    }

    function fundInvoice(uint256 invoiceId) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused whenNotShutdown {
        InvoiceNFT.Invoice memory inv = invoiceNFT.getInvoice(invoiceId);
        require(inv.status == InvoiceNFT.InvoiceStatus.VALIDATED, "VM: must be validated");

        VaultTier tier = getVaultTierForRisk(inv.riskScore);
        Vault storage vault = vaults[tier];

        require(vault.isActive, "VM: vault not active");
        require(inv.riskScore <= vault.maxRiskScore, "VM: risk score too high");

        uint256 fundingAmount = (inv.amount * vault.advanceRate) / BASIS_POINTS;
        require(getAvailableLiquidity(tier) >= fundingAmount, "VM: insufficient liquidity");

        vault.totalAllocated += fundingAmount;
        invoiceAllocations[invoiceId] = tier;
        invoiceFunding[invoiceId] = fundingAmount;

        stablecoin.safeTransfer(inv.borrower, fundingAmount);
        invoiceNFT.markAsFunded(invoiceId, fundingAmount);

        emit InvoiceFunded(invoiceId, tier, fundingAmount);
    }

    function processRepayment(uint256 invoiceId, uint256 repaymentAmount)
        external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused whenNotShutdown
    {
        InvoiceNFT.Invoice memory inv = invoiceNFT.getInvoice(invoiceId);
        require(inv.status == InvoiceNFT.InvoiceStatus.FUNDED, "VM: not funded");

        VaultTier tier = invoiceAllocations[invoiceId];
        Vault storage vault = vaults[tier];
        uint256 fundedAmount = invoiceFunding[invoiceId];

        stablecoin.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        uint256 platformFee = (repaymentAmount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 vaultReturn = repaymentAmount - platformFee;

        vault.totalAllocated -= fundedAmount;

        if (vaultReturn >= fundedAmount) {
            uint256 yield_ = vaultReturn - fundedAmount;
            vault.totalReturns += yield_;
            emit YieldDistributed(tier, yield_);
        } else {
            uint256 loss = fundedAmount - vaultReturn;
            vault.totalBadDebt += loss;
            emit BadDebtWrittenOff(tier, loss);
        }

        invoiceNFT.markAsPaid(invoiceId, repaymentAmount);

        if (platformFee > 0) {
            stablecoin.safeTransfer(feeCollector, platformFee);
        }

        emit InvoiceRepaid(invoiceId, repaymentAmount, vaultReturn > fundedAmount ? vaultReturn - fundedAmount : 0);
    }

    function processDefault(uint256 invoiceId) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused whenNotShutdown {
        InvoiceNFT.Invoice memory inv = invoiceNFT.getInvoice(invoiceId);
        require(inv.status == InvoiceNFT.InvoiceStatus.DEFAULTED, "VM: not defaulted");

        VaultTier tier = invoiceAllocations[invoiceId];
        Vault storage vault = vaults[tier];
        uint256 fundedAmount = invoiceFunding[invoiceId];
        require(fundedAmount > 0, "VM: not funded by vault");

        vault.totalAllocated -= fundedAmount;
        vault.totalBadDebt += fundedAmount;

        emit BadDebtWrittenOff(tier, fundedAmount);
        emit InvoiceDefaulted(invoiceId, fundedAmount);

        delete invoiceAllocations[invoiceId];
        delete invoiceFunding[invoiceId];
    }

    function rebalance(uint8 fromTier, uint8 toTier, uint256 amount)
        external onlyRole(AGENT_ROLE) nonReentrant whenNotPaused whenNotShutdown
    {
        require(fromTier < 3 && toTier < 3, "VM: invalid tier");
        require(fromTier != toTier, "VM: same tier");
        require(amount > 0, "VM: zero amount");

        Vault storage fromVault = vaults[VaultTier(fromTier)];
        Vault storage toVault = vaults[VaultTier(toTier)];

        require(fromVault.isActive && toVault.isActive, "VM: vault not active");
        require(getAvailableLiquidity(VaultTier(fromTier)) >= amount, "VM: insufficient liquidity");

        fromVault.totalDeposits -= amount;
        toVault.totalDeposits += amount;

        rebalanceLoans.push(CrossVaultLoan({
            fromTier: fromTier,
            toTier: toTier,
            amount: amount,
            timestamp: block.timestamp,
            active: true
        }));

        emit VaultRebalanced(fromTier, toTier, amount, rebalanceLoans.length - 1);
    }

    function reverseRebalance(uint256 loanIndex) external onlyRole(AGENT_ROLE) nonReentrant whenNotPaused whenNotShutdown {
        require(loanIndex < rebalanceLoans.length, "VM: invalid loan index");
        CrossVaultLoan storage loan = rebalanceLoans[loanIndex];
        require(loan.active, "VM: loan already reversed");

        Vault storage fromVault = vaults[VaultTier(loan.toTier)];
        Vault storage toVault = vaults[VaultTier(loan.fromTier)];

        require(getAvailableLiquidity(VaultTier(loan.toTier)) >= loan.amount, "VM: insufficient liquidity to reverse");

        fromVault.totalDeposits -= loan.amount;
        toVault.totalDeposits += loan.amount;

        loan.active = false;

        emit RebalanceReversed(loan.fromTier, loan.toTier, loan.amount, loanIndex);
    }

    function getVaultTierForRisk(uint256 riskScore) public pure returns (VaultTier) {
        if (riskScore <= 30) return VaultTier.PRIME;
        if (riskScore <= 60) return VaultTier.GROWTH;
        return VaultTier.EMERGING;
    }

    function getTotalShares(VaultTier tier) public view returns (uint256) {
        Vault memory v = vaults[tier];
        if (v.totalDeposits == 0) return 0;
        return v.totalDeposits;
    }

    function getTotalValue(VaultTier tier) public view returns (uint256) {
        Vault memory v = vaults[tier];
        uint256 netAssets = v.totalDeposits + v.totalReturns;
        uint256 unrecoverable = v.totalBadDebt;
        if (netAssets <= unrecoverable) return 0;
        return netAssets - unrecoverable;
    }

    function getPosition(VaultTier tier, address investor) external view returns (InvestorPosition memory) {
        return positions[tier][investor];
    }

    function getAvailableLiquidity(VaultTier tier) public view returns (uint256) {
        Vault memory v = vaults[tier];
        uint256 liquid = v.totalDeposits + v.totalReturns;
        uint256 locked = v.totalAllocated + v.totalBadDebt;
        if (liquid <= locked) return 0;
        return liquid - locked;
    }

    function getVault(VaultTier tier) external view returns (Vault memory) {
        return vaults[tier];
    }

    function getVaultState(uint8 tier) external view returns (uint256 tvl, uint256 utilization, uint256 currentApy) {
        Vault memory v = vaults[VaultTier(tier)];
        tvl = getTotalValue(VaultTier(tier));
        uint256 depositBase = v.totalDeposits + v.totalReturns;
        if (depositBase > 0 && v.totalAllocated > 0) {
            utilization = (v.totalAllocated * BASIS_POINTS) / depositBase;
        }
        uint256 timeElapsed = block.timestamp - v.createdAt;
        if (v.totalReturns > 0 && v.totalDeposits > 0 && timeElapsed > 0) {
            currentApy = (v.totalReturns * BASIS_POINTS * 365 days) / (v.totalDeposits * timeElapsed);
        }
    }

    function getFreeLiquidity() external view returns (uint256) {
        uint256 total;
        for (uint8 i = 0; i < 3; i++) {
            total += getTotalValue(VaultTier(i));
        }
        return total;
    }

    function getTotalAUM() external view returns (uint256) {
        uint256 total;
        for (uint8 i = 0; i < 3; i++) {
            Vault memory v = vaults[VaultTier(i)];
            total += v.totalDeposits + v.totalReturns;
        }
        return total;
    }

    function getLoanCount() external view returns (uint256) {
        return rebalanceLoans.length;
    }

    function getActiveLoanCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < rebalanceLoans.length; i++) {
            if (rebalanceLoans[i].active) count++;
        }
        return count;
    }

    function updateVaultParameters(
        VaultTier tier,
        uint256 minDeposit,
        uint256 maxRiskScore,
        uint256 advanceRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxRiskScore <= 100, "VM: risk score max 100");
        require(advanceRate <= BASIS_POINTS, "VM: advance rate max 100%");

        Vault storage v = vaults[tier];
        v.minDeposit = minDeposit;
        v.maxRiskScore = maxRiskScore;
        v.advanceRate = advanceRate;
    }

    function setFeeCollector(address collector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(collector != address(0), "VM: zero address");
        feeCollector = collector;
    }

    function setVaultActive(VaultTier tier, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaults[tier].isActive = active;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
