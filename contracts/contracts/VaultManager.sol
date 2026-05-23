// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./InvoiceNFT.sol";

/**
 * @title VaultManager
 * @dev Manages liquidity vaults for invoice financing on TILV platform
 * Three risk tiers: Prime (low risk), Growth (mid risk), Emerging (high yield)
 */
contract VaultManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum VaultTier {
        PRIME,      // Low risk: 4-6% APY, risk score 0-30
        GROWTH,     // Medium risk: 8-12% APY, risk score 31-60
        EMERGING    // High yield: 15-25% APY, risk score 61-100
    }

    struct Vault {
        VaultTier tier;
        uint256 totalDeposits;          // Total USDT/USDC deposited
        uint256 totalAllocated;         // Amount allocated to invoices
        uint256 totalReturns;           // Total returns collected
        uint256 minDeposit;             // Minimum deposit amount
        uint256 maxRiskScore;           // Maximum risk score for invoices
        uint256 advanceRate;            // Percentage to advance (e.g., 80% = 8000)
        bool isActive;
    }

    struct InvestorPosition {
        uint256 depositedAmount;
        uint256 shares;                 // Share of vault pool
        uint256 depositTimestamp;
        uint256 claimedReturns;
    }

    // State variables
    IERC20 public stablecoin;          // USDT or USDC
    InvoiceNFT public invoiceNFT;
    
    // Vaults by tier
    mapping(VaultTier => Vault) public vaults;
    
    // Investor positions: tier => investor => position
    mapping(VaultTier => mapping(address => InvestorPosition)) public positions;
    
    // Invoice allocations: invoiceId => vault tier
    mapping(uint256 => VaultTier) public invoiceAllocations;
    
    // Invoice funding amounts
    mapping(uint256 => uint256) public invoiceFunding;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;  // 100% = 10000
    uint256 public constant PLATFORM_FEE = 200;    // 2% platform fee

    // Events
    event VaultDeposit(address indexed investor, VaultTier tier, uint256 amount, uint256 shares);
    event VaultWithdrawal(address indexed investor, VaultTier tier, uint256 amount, uint256 shares);
    event InvoiceFunded(uint256 indexed invoiceId, VaultTier tier, uint256 amount);
    event InvoiceRepaid(uint256 indexed invoiceId, uint256 amount, uint256 yield);
    event YieldDistributed(VaultTier tier, uint256 totalYield);

    constructor(address _stablecoin, address _invoiceNFT) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        require(_invoiceNFT != address(0), "Invalid invoiceNFT address");
        
        stablecoin = IERC20(_stablecoin);
        invoiceNFT = InvoiceNFT(_invoiceNFT);

        // Initialize Prime Vault
        vaults[VaultTier.PRIME] = Vault({
            tier: VaultTier.PRIME,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 1000 * 10**6,      // 1000 USDT (assuming 6 decimals)
            maxRiskScore: 30,
            advanceRate: 8000,              // 80%
            isActive: true
        });

        // Initialize Growth Vault
        vaults[VaultTier.GROWTH] = Vault({
            tier: VaultTier.GROWTH,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 500 * 10**6,       // 500 USDT
            maxRiskScore: 60,
            advanceRate: 7500,              // 75%
            isActive: true
        });

        // Initialize Emerging Vault
        vaults[VaultTier.EMERGING] = Vault({
            tier: VaultTier.EMERGING,
            totalDeposits: 0,
            totalAllocated: 0,
            totalReturns: 0,
            minDeposit: 100 * 10**6,       // 100 USDT
            maxRiskScore: 100,
            advanceRate: 7000,              // 70%
            isActive: true
        });
    }

    /**
     * @dev Investor deposits stablecoin into a specific vault tier
     * @param tier The vault tier to deposit into
     * @param amount Amount of stablecoin to deposit
     */
    function deposit(VaultTier tier, uint256 amount) external nonReentrant {
        Vault storage vault = vaults[tier];
        require(vault.isActive, "Vault is not active");
        require(amount >= vault.minDeposit, "Amount below minimum deposit");

        InvestorPosition storage position = positions[tier][msg.sender];

        // Transfer stablecoin from investor
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares (proportional to deposit)
        uint256 shares;
        if (vault.totalDeposits == 0) {
            shares = amount;
        } else {
            shares = (amount * getTotalShares(tier)) / vault.totalDeposits;
        }

        // Update position
        position.depositedAmount += amount;
        position.shares += shares;
        if (position.depositTimestamp == 0) {
            position.depositTimestamp = block.timestamp;
        }

        // Update vault
        vault.totalDeposits += amount;

        emit VaultDeposit(msg.sender, tier, amount, shares);
    }

    /**
     * @dev Investor withdraws their funds and accrued yield
     * @param tier The vault tier to withdraw from
     * @param shares Number of shares to withdraw
     */
    function withdraw(VaultTier tier, uint256 shares) external nonReentrant {
        Vault storage vault = vaults[tier];
        InvestorPosition storage position = positions[tier][msg.sender];
        
        require(position.shares >= shares, "Insufficient shares");
        require(vault.totalDeposits >= vault.totalAllocated, "Insufficient liquidity");

        // Calculate withdrawal amount (principal + yield)
        uint256 totalValue = vault.totalDeposits + vault.totalReturns - vault.totalAllocated;
        uint256 totalShares = getTotalShares(tier);
        uint256 withdrawAmount = (shares * totalValue) / totalShares;

        // Update position
        position.shares -= shares;
        position.depositedAmount = (position.depositedAmount * (position.shares)) / (position.shares + shares);

        // Update vault
        vault.totalDeposits -= withdrawAmount;

        // Transfer stablecoin to investor
        stablecoin.safeTransfer(msg.sender, withdrawAmount);

        emit VaultWithdrawal(msg.sender, tier, withdrawAmount, shares);
    }

    /**
     * @dev Fund an invoice from appropriate vault based on risk score
     * @param invoiceId The invoice NFT ID
     */
    function fundInvoice(uint256 invoiceId) external onlyOwner nonReentrant {
        InvoiceNFT.Invoice memory invoice = invoiceNFT.getInvoice(invoiceId);
        
        require(
            invoice.status == InvoiceNFT.InvoiceStatus.VALIDATED,
            "Invoice must be validated"
        );

        // Determine vault tier based on risk score
        VaultTier tier = getVaultTierForRisk(invoice.riskScore);
        Vault storage vault = vaults[tier];

        require(vault.isActive, "Vault is not active");
        require(invoice.riskScore <= vault.maxRiskScore, "Risk score too high for vault");

        // Calculate funding amount
        uint256 fundingAmount = (invoice.amount * vault.advanceRate) / BASIS_POINTS;
        
        require(
            vault.totalDeposits - vault.totalAllocated >= fundingAmount,
            "Insufficient vault liquidity"
        );

        // Update vault allocation
        vault.totalAllocated += fundingAmount;
        invoiceAllocations[invoiceId] = tier;
        invoiceFunding[invoiceId] = fundingAmount;

        // Transfer funds to borrower
        stablecoin.safeTransfer(invoice.borrower, fundingAmount);

        // Update invoice status in NFT contract
        invoiceNFT.markAsFunded(invoiceId, fundingAmount);

        emit InvoiceFunded(invoiceId, tier, fundingAmount);
    }

    /**
     * @dev Process invoice repayment from buyer
     * @param invoiceId The invoice NFT ID
     * @param repaymentAmount Amount paid by buyer
     */
    function processRepayment(uint256 invoiceId, uint256 repaymentAmount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        InvoiceNFT.Invoice memory invoice = invoiceNFT.getInvoice(invoiceId);
        require(
            invoice.status == InvoiceNFT.InvoiceStatus.FUNDED,
            "Invoice not in funded status"
        );

        VaultTier tier = invoiceAllocations[invoiceId];
        Vault storage vault = vaults[tier];
        uint256 fundedAmount = invoiceFunding[invoiceId];

        // Transfer repayment to contract
        stablecoin.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        // Calculate platform fee
        uint256 platformFee = (repaymentAmount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 vaultReturn = repaymentAmount - platformFee;

        // Calculate yield
        uint256 yield = vaultReturn > fundedAmount ? vaultReturn - fundedAmount : 0;

        // Update vault
        vault.totalAllocated -= fundedAmount;
        vault.totalReturns += yield;
        vault.totalDeposits += yield;  // Add yield to available liquidity

        // Mark invoice as paid
        invoiceNFT.markAsPaid(invoiceId, repaymentAmount);

        // Transfer platform fee to owner
        if (platformFee > 0) {
            stablecoin.safeTransfer(owner(), platformFee);
        }

        emit InvoiceRepaid(invoiceId, repaymentAmount, yield);
        emit YieldDistributed(tier, yield);
    }

    /**
     * @dev Get vault tier based on risk score
     * @param riskScore The risk score (0-100)
     * @return VaultTier appropriate for the risk
     */
    function getVaultTierForRisk(uint256 riskScore) public pure returns (VaultTier) {
        if (riskScore <= 30) {
            return VaultTier.PRIME;
        } else if (riskScore <= 60) {
            return VaultTier.GROWTH;
        } else {
            return VaultTier.EMERGING;
        }
    }

    /**
     * @dev Get total shares in a vault tier
     * @param tier The vault tier
     * @return Total shares
     */
    function getTotalShares(VaultTier tier) public view returns (uint256) {
        // In a production system, this would track all investors
        // For simplicity, we use total deposits as proxy
        return vaults[tier].totalDeposits;
    }

    /**
     * @dev Get investor position details
     * @param tier Vault tier
     * @param investor Investor address
     * @return Position details
     */
    function getPosition(VaultTier tier, address investor) 
        external 
        view 
        returns (InvestorPosition memory) 
    {
        return positions[tier][investor];
    }

    /**
     * @dev Get available liquidity in a vault
     * @param tier Vault tier
     * @return Available amount
     */
    function getAvailableLiquidity(VaultTier tier) external view returns (uint256) {
        Vault memory vault = vaults[tier];
        return vault.totalDeposits - vault.totalAllocated;
    }

    /**
     * @dev Get vault statistics
     * @param tier Vault tier
     * @return Vault struct
     */
    function getVault(VaultTier tier) external view returns (Vault memory) {
        return vaults[tier];
    }

    /**
     * @dev Admin function to update vault parameters
     * @param tier Vault tier
     * @param minDeposit New minimum deposit
     * @param maxRiskScore New maximum risk score
     * @param advanceRate New advance rate
     */
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

    /**
     * @dev Admin function to activate/deactivate vault
     * @param tier Vault tier
     * @param active New active status
     */
    function setVaultActive(VaultTier tier, bool active) external onlyOwner {
        vaults[tier].isActive = active;
    }
}
