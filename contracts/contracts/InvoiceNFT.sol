// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title InvoiceNFT
 * @dev ERC-721 token representing tokenized invoices for TILV platform
 * Each NFT represents a real-world invoice that can be used as collateral for liquidity
 */
contract InvoiceNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    Counters.Counter private _tokenIdCounter;

    enum InvoiceStatus {
        PENDING,        // Invoice uploaded, awaiting validation
        VALIDATED,      // AI validation complete, awaiting funding
        FUNDED,         // Borrower received advance payment
        PAID,           // Buyer paid the invoice
        DEFAULTED,      // Invoice payment overdue
        CANCELLED       // Invoice cancelled
    }

    struct Invoice {
        address borrower;           // SME/merchant who owns the invoice
        address buyer;              // Company that owes payment
        uint256 amount;             // Invoice amount in wei (USDT/USDC)
        uint256 dueDate;            // Payment due date timestamp
        uint256 advanceRate;        // Percentage paid upfront (e.g., 80% = 8000)
        uint256 riskScore;          // Risk score from AI (0-100)
        InvoiceStatus status;       // Current invoice status
        uint256 fundedAmount;       // Amount actually funded
        uint256 createdAt;          // Creation timestamp
        bytes32 validationHash;     // Hash of validation data from AI
        string metadataURI;         // IPFS URI for invoice PDF and metadata
    }

    // Mapping from token ID to invoice data
    mapping(uint256 => Invoice) public invoices;

    // Events
    event InvoiceMinted(
        uint256 indexed tokenId,
        address indexed borrower,
        uint256 amount,
        uint256 riskScore
    );
    
    event InvoiceValidated(uint256 indexed tokenId, uint256 riskScore);
    event InvoiceFunded(uint256 indexed tokenId, uint256 fundedAmount);
    event InvoicePaid(uint256 indexed tokenId, uint256 paidAmount);
    event InvoiceDefaulted(uint256 indexed tokenId);
    event InvoiceCancelled(uint256 indexed tokenId);
    event InvoiceStatusChanged(uint256 indexed tokenId, InvoiceStatus newStatus);

    constructor() ERC721("TILV Invoice", "TINV") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
    }

    /**
     * @dev Mint a new invoice NFT
     * @param borrower Address of the invoice owner (SME/merchant)
     * @param buyer Address of the company that owes payment
     * @param amount Invoice amount
     * @param dueDate Payment due date
     * @param metadataURI IPFS URI for invoice document
     * @return tokenId The ID of the newly minted NFT
     */
    function mintInvoice(
        address borrower,
        address buyer,
        uint256 amount,
        uint256 dueDate,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(borrower != address(0), "Invalid borrower address");
        require(buyer != address(0), "Invalid buyer address");
        require(amount > 0, "Amount must be greater than 0");
        require(dueDate > block.timestamp, "Due date must be in the future");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(borrower, tokenId);
        _setTokenURI(tokenId, metadataURI);

        invoices[tokenId] = Invoice({
            borrower: borrower,
            buyer: buyer,
            amount: amount,
            dueDate: dueDate,
            advanceRate: 0,
            riskScore: 0,
            status: InvoiceStatus.PENDING,
            fundedAmount: 0,
            createdAt: block.timestamp,
            validationHash: bytes32(0),
            metadataURI: metadataURI
        });

        emit InvoiceMinted(tokenId, borrower, amount, 0);
        return tokenId;
    }

    /**
     * @dev Validate an invoice with risk scoring from AI engine
     * @param tokenId The invoice NFT ID
     * @param riskScore Risk score from AI (0-100)
     * @param advanceRate Percentage to advance to borrower
     * @param validationHash Hash of validation data
     */
    function validateInvoice(
        uint256 tokenId,
        uint256 riskScore,
        uint256 advanceRate,
        bytes32 validationHash
    ) external onlyRole(VALIDATOR_ROLE) {
        require(_exists(tokenId), "Invoice does not exist");
        require(invoices[tokenId].status == InvoiceStatus.PENDING, "Invoice already validated");
        require(riskScore <= 100, "Risk score must be <= 100");
        require(advanceRate <= 10000, "Advance rate must be <= 10000 (100%)");

        invoices[tokenId].riskScore = riskScore;
        invoices[tokenId].advanceRate = advanceRate;
        invoices[tokenId].validationHash = validationHash;
        invoices[tokenId].status = InvoiceStatus.VALIDATED;

        emit InvoiceValidated(tokenId, riskScore);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.VALIDATED);
    }

    /**
     * @dev Mark invoice as funded
     * @param tokenId The invoice NFT ID
     * @param fundedAmount Amount provided to borrower
     */
    function markAsFunded(uint256 tokenId, uint256 fundedAmount) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(_exists(tokenId), "Invoice does not exist");
        require(invoices[tokenId].status == InvoiceStatus.VALIDATED, "Invoice not validated");
        
        invoices[tokenId].fundedAmount = fundedAmount;
        invoices[tokenId].status = InvoiceStatus.FUNDED;

        emit InvoiceFunded(tokenId, fundedAmount);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.FUNDED);
    }

    /**
     * @dev Mark invoice as paid by buyer
     * @param tokenId The invoice NFT ID
     * @param paidAmount Amount paid by buyer
     */
    function markAsPaid(uint256 tokenId, uint256 paidAmount) 
        external 
        onlyRole(VALIDATOR_ROLE) 
    {
        require(_exists(tokenId), "Invoice does not exist");
        require(invoices[tokenId].status == InvoiceStatus.FUNDED, "Invoice not in funded status");
        
        invoices[tokenId].status = InvoiceStatus.PAID;

        emit InvoicePaid(tokenId, paidAmount);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.PAID);
    }

    /**
     * @dev Mark invoice as defaulted (payment overdue)
     * @param tokenId The invoice NFT ID
     */
    function markAsDefaulted(uint256 tokenId) external onlyRole(VALIDATOR_ROLE) {
        require(_exists(tokenId), "Invoice does not exist");
        require(block.timestamp > invoices[tokenId].dueDate, "Not yet overdue");
        require(invoices[tokenId].status == InvoiceStatus.FUNDED, "Invoice not funded");
        
        invoices[tokenId].status = InvoiceStatus.DEFAULTED;

        emit InvoiceDefaulted(tokenId);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.DEFAULTED);
    }

    /**
     * @dev Cancel an invoice
     * @param tokenId The invoice NFT ID
     */
    function cancelInvoice(uint256 tokenId) external {
        require(_exists(tokenId), "Invoice does not exist");
        require(
            msg.sender == invoices[tokenId].borrower || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only borrower or admin can cancel"
        );
        require(
            invoices[tokenId].status == InvoiceStatus.PENDING || 
            invoices[tokenId].status == InvoiceStatus.VALIDATED,
            "Cannot cancel funded invoice"
        );
        
        invoices[tokenId].status = InvoiceStatus.CANCELLED;

        emit InvoiceCancelled(tokenId);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.CANCELLED);
    }

    /**
     * @dev Get invoice details
     * @param tokenId The invoice NFT ID
     * @return Invoice struct
     */
    function getInvoice(uint256 tokenId) external view returns (Invoice memory) {
        require(_exists(tokenId), "Invoice does not exist");
        return invoices[tokenId];
    }

    /**
     * @dev Get total number of invoices minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Override to support interfaces
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
