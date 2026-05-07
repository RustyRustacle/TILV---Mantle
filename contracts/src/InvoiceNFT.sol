// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
contract InvoiceNFT is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    uint256 private _tokenIdCounter;

    enum InvoiceStatus {
        PENDING,
        VALIDATED,
        FUNDED,
        PAID,
        DEFAULTED,
        CANCELLED
    }

    struct Invoice {
        address borrower;
        address buyer;
        uint256 amount;
        uint256 dueDate;
        uint256 advanceRate;
        uint256 riskScore;
        InvoiceStatus status;
        uint256 fundedAmount;
        uint256 createdAt;
        bytes32 validationHash;
        string metadataURI;
    }

    mapping(uint256 => Invoice) public invoices;

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

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

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

    function validateInvoice(
        uint256 tokenId,
        uint256 riskScore,
        uint256 advanceRate,
        bytes32 validationHash
    ) external onlyRole(VALIDATOR_ROLE) {
        _requireOwned(tokenId);
        require(invoices[tokenId].status == InvoiceStatus.PENDING, "Invoice not pending");
        require(riskScore <= 100, "Risk score must be <= 100");
        require(advanceRate <= 10000, "Advance rate must be <= 10000 (100%)");

        invoices[tokenId].riskScore = riskScore;
        invoices[tokenId].advanceRate = advanceRate;
        invoices[tokenId].validationHash = validationHash;
        invoices[tokenId].status = InvoiceStatus.VALIDATED;

        emit InvoiceValidated(tokenId, riskScore);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.VALIDATED);
    }

    function markAsFunded(uint256 tokenId, uint256 fundedAmount)
        external
        onlyRole(MINTER_ROLE)
    {
        _requireOwned(tokenId);
        require(invoices[tokenId].status == InvoiceStatus.VALIDATED, "Invoice not validated");

        invoices[tokenId].fundedAmount = fundedAmount;
        invoices[tokenId].status = InvoiceStatus.FUNDED;

        emit InvoiceFunded(tokenId, fundedAmount);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.FUNDED);
    }

    function markAsPaid(uint256 tokenId, uint256 paidAmount)
        external
        onlyRole(VALIDATOR_ROLE)
    {
        _requireOwned(tokenId);
        require(invoices[tokenId].status == InvoiceStatus.FUNDED, "Invoice not in funded status");

        invoices[tokenId].status = InvoiceStatus.PAID;

        emit InvoicePaid(tokenId, paidAmount);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.PAID);
    }

    function markAsDefaulted(uint256 tokenId) external onlyRole(VALIDATOR_ROLE) {
        _requireOwned(tokenId);
        require(block.timestamp > invoices[tokenId].dueDate, "Not yet overdue");
        require(invoices[tokenId].status == InvoiceStatus.FUNDED, "Invoice not funded");

        invoices[tokenId].status = InvoiceStatus.DEFAULTED;

        emit InvoiceDefaulted(tokenId);
        emit InvoiceStatusChanged(tokenId, InvoiceStatus.DEFAULTED);
    }

    function cancelInvoice(uint256 tokenId) external {
        _requireOwned(tokenId);
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

    function getInvoice(uint256 tokenId) external view returns (Invoice memory) {
        _requireOwned(tokenId);
        return invoices[tokenId];
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
