const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InvoiceNFT", function () {
  let invoiceNFT, owner, minter, validator, buyer, borrower, user;

  beforeEach(async function () {
    [owner, minter, validator, buyer, borrower, user] = await ethers.getSigners();
    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    invoiceNFT = await InvoiceNFT.deploy();
    await invoiceNFT.waitForDeployment();

    const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
    const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();

    await invoiceNFT.grantRole(MINTER_ROLE, minter.address);
    await invoiceNFT.grantRole(VALIDATOR_ROLE, validator.address);
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await invoiceNFT.name()).to.equal("TILV Invoice");
      expect(await invoiceNFT.symbol()).to.equal("TINV");
    });

    it("should grant DEFAULT_ADMIN_ROLE to owner", async function () {
      const DEFAULT_ADMIN_ROLE = await invoiceNFT.DEFAULT_ADMIN_ROLE();
      expect(await invoiceNFT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should start with zero total supply", async function () {
      expect(await invoiceNFT.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("should mint invoice with correct data", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
      const tx = await invoiceNFT.connect(minter).mintInvoice(
        borrower.address,
        buyer.address,
        ethers.parseUnits("1000", 6),
        dueDate,
        "ipfs://test"
      );
      await tx.wait();

      expect(await invoiceNFT.totalSupply()).to.equal(1);
      expect(await invoiceNFT.ownerOf(0)).to.equal(borrower.address);

      const invoice = await invoiceNFT.getInvoice(0);
      expect(invoice.borrower).to.equal(borrower.address);
      expect(invoice.buyer).to.equal(buyer.address);
      expect(invoice.amount).to.equal(ethers.parseUnits("1000", 6));
      expect(invoice.dueDate).to.equal(dueDate);
      expect(invoice.status).to.equal(0); // PENDING
    });

    it("should revert if not called by minter", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
      await expect(
        invoiceNFT.connect(user).mintInvoice(
          borrower.address,
          buyer.address,
          1000,
          dueDate,
          "ipfs://test"
        )
      ).to.be.reverted;
    });

    it("should revert with invalid borrower or buyer", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
      await expect(
        invoiceNFT.connect(minter).mintInvoice(
          ethers.ZeroAddress,
          buyer.address,
          1000,
          dueDate,
          "ipfs://test"
        )
      ).to.be.revertedWith("Invalid borrower address");

      await expect(
        invoiceNFT.connect(minter).mintInvoice(
          borrower.address,
          ethers.ZeroAddress,
          1000,
          dueDate,
          "ipfs://test"
        )
      ).to.be.revertedWith("Invalid buyer address");
    });

    it("should revert with amount of zero", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
      await expect(
        invoiceNFT.connect(minter).mintInvoice(
          borrower.address,
          buyer.address,
          0,
          dueDate,
          "ipfs://test"
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert with past due date", async function () {
      const pastDate = Math.floor(Date.now() / 1000) - 86400;
      await expect(
        invoiceNFT.connect(minter).mintInvoice(
          borrower.address,
          buyer.address,
          1000,
          pastDate,
          "ipfs://test"
        )
      ).to.be.revertedWith("Due date must be in the future");
    });
  });

  describe("Validation", function () {
    let tokenId;
    const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;

    beforeEach(async function () {
      const tx = await invoiceNFT.connect(minter).mintInvoice(
        borrower.address,
        buyer.address,
        ethers.parseUnits("1000", 6),
        dueDate,
        "ipfs://test"
      );
      const receipt = await tx.wait();
      tokenId = 0;
    });

    it("should validate invoice", async function () {
      await invoiceNFT.connect(validator).validateInvoice(
        tokenId, 25, 8000, ethers.randomBytes(32)
      );

      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.riskScore).to.equal(25);
      expect(invoice.advanceRate).to.equal(8000);
      expect(invoice.status).to.equal(1); // VALIDATED
    });

    it("should revert if not called by validator", async function () {
      await expect(
        invoiceNFT.connect(user).validateInvoice(
          tokenId, 25, 8000, ethers.randomBytes(32)
        )
      ).to.be.reverted;
    });

    it("should revert if already validated", async function () {
      await invoiceNFT.connect(validator).validateInvoice(
        tokenId, 25, 8000, ethers.randomBytes(32)
      );

      await expect(
        invoiceNFT.connect(validator).validateInvoice(
          tokenId, 30, 7500, ethers.randomBytes(32)
        )
      ).to.be.revertedWith("Invoice not pending");
    });

    it("should revert with risk score > 100", async function () {
      await expect(
        invoiceNFT.connect(validator).validateInvoice(
          tokenId, 101, 8000, ethers.randomBytes(32)
        )
      ).to.be.revertedWith("Risk score must be <= 100");
    });
  });

  describe("Lifecycle", function () {
    let tokenId;
    let dueDate;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      dueDate = block.timestamp + 86400 * 30;
      const tx = await invoiceNFT.connect(minter).mintInvoice(
        borrower.address,
        buyer.address,
        ethers.parseUnits("1000", 6),
        dueDate,
        "ipfs://test"
      );
      await tx.wait();
      tokenId = 0;
      await invoiceNFT.connect(validator).validateInvoice(
        tokenId, 25, 8000, ethers.randomBytes(32)
      );
    });

    it("should mark as funded", async function () {
      await invoiceNFT.connect(minter).markAsFunded(tokenId, 800);
      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.fundedAmount).to.equal(800);
      expect(invoice.status).to.equal(2); // FUNDED
    });

    it("should mark as paid", async function () {
      await invoiceNFT.connect(minter).markAsFunded(tokenId, 800);
      await invoiceNFT.connect(validator).markAsPaid(tokenId, 1000);
      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.status).to.equal(3); // PAID
    });

    it("should mark as defaulted after due date", async function () {
      await invoiceNFT.connect(minter).markAsFunded(tokenId, 800);

      await ethers.provider.send("evm_increaseTime", [86400 * 31]);
      await ethers.provider.send("evm_mine");

      await invoiceNFT.connect(validator).markAsDefaulted(tokenId);
      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.status).to.equal(4); // DEFAULTED
    });

    it("should cancel invoice by borrower", async function () {
      await invoiceNFT.connect(borrower).cancelInvoice(tokenId);
      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.status).to.equal(5); // CANCELLED
    });

    it("should cancel invoice by admin", async function () {
      await invoiceNFT.connect(owner).cancelInvoice(tokenId);
      const invoice = await invoiceNFT.getInvoice(tokenId);
      expect(invoice.status).to.equal(5); // CANCELLED
    });
  });
});
