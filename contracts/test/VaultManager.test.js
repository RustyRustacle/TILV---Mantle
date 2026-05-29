const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VaultManager", function () {
  let vaultManager, invoiceNFT, stablecoin, owner, investor, borrower, agent, user;
  const USDT_DECIMALS = 6;
  const BASIS_POINTS = 10000;

  beforeEach(async function () {
    [owner, investor, borrower, agent, user] = await ethers.getSigners();

    const Stablecoin = await ethers.getContractFactory("MockERC20");
    stablecoin = await Stablecoin.deploy("USDT", "USDT", USDT_DECIMALS);
    await stablecoin.waitForDeployment();

    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    invoiceNFT = await InvoiceNFT.deploy();
    await invoiceNFT.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy(
      await stablecoin.getAddress(),
      await invoiceNFT.getAddress()
    );
    await vaultManager.waitForDeployment();

    const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
    await invoiceNFT.grantRole(MINTER_ROLE, await vaultManager.getAddress());

    const AGENT_ROLE = await vaultManager.AGENT_ROLE();
    await vaultManager.grantRole(AGENT_ROLE, agent.address);

    await stablecoin.mint(investor.address, ethers.parseUnits("10000", USDT_DECIMALS));
    await stablecoin.connect(investor).approve(
      await vaultManager.getAddress(),
      ethers.parseUnits("10000", USDT_DECIMALS)
    );
  });

  describe("Deployment", function () {
    it("should initialize vaults correctly", async function () {
      const prime = await vaultManager.vaults(0);
      expect(prime.minDeposit).to.equal(ethers.parseUnits("1000", USDT_DECIMALS));
      expect(prime.maxRiskScore).to.equal(30);
      expect(prime.advanceRate).to.equal(8000);
      expect(prime.isActive).to.be.true;

      const growth = await vaultManager.vaults(1);
      expect(growth.minDeposit).to.equal(ethers.parseUnits("500", USDT_DECIMALS));
      expect(growth.maxRiskScore).to.equal(60);
      expect(growth.advanceRate).to.equal(7500);

      const emerging = await vaultManager.vaults(2);
      expect(emerging.minDeposit).to.equal(ethers.parseUnits("100", USDT_DECIMALS));
      expect(emerging.maxRiskScore).to.equal(100);
      expect(emerging.advanceRate).to.equal(7000);
    });

    it("should set default admin role to owner", async function () {
      const DEFAULT_ADMIN_ROLE = await vaultManager.DEFAULT_ADMIN_ROLE();
      expect(await vaultManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should have AGENT_ROLE defined", async function () {
      const AGENT_ROLE = await vaultManager.AGENT_ROLE();
      expect(AGENT_ROLE).to.not.be.undefined;
    });
  });

  describe("Deposits", function () {
    it("should accept deposits", async function () {
      const amount = ethers.parseUnits("1000", USDT_DECIMALS);
      await vaultManager.connect(investor).deposit(0, amount, 0);

      const vault = await vaultManager.vaults(0);
      expect(vault.totalDeposits).to.equal(amount);

      const position = await vaultManager.getPosition(0, investor.address);
      expect(position.depositedAmount).to.equal(amount);
      expect(position.shares).to.equal(amount);
    });

    it("should reject deposits below minimum", async function () {
      const amount = ethers.parseUnits("100", USDT_DECIMALS);
      await expect(
        vaultManager.connect(investor).deposit(0, amount, 0)
      ).to.be.revertedWith("VM: below minimum deposit");
    });

    it("should reject deposits to inactive vault", async function () {
      await vaultManager.connect(owner).setVaultActive(0, false);
      await expect(
        vaultManager.connect(investor).deposit(0, ethers.parseUnits("1000", USDT_DECIMALS), 0)
      ).to.be.revertedWith("VM: vault not active");
    });

    it("should reject deposits when paused", async function () {
      await vaultManager.connect(owner).pause();
      await expect(
        vaultManager.connect(investor).deposit(0, ethers.parseUnits("1000", USDT_DECIMALS), 0)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await vaultManager.connect(investor).deposit(0, ethers.parseUnits("2000", USDT_DECIMALS), 0);
    });

    it("should allow partial withdrawal", async function () {
      const withdrawShares = ethers.parseUnits("1000", USDT_DECIMALS);
      const balanceBefore = await stablecoin.balanceOf(investor.address);
      await vaultManager.connect(investor).withdraw(0, withdrawShares, 0);
      const balanceAfter = await stablecoin.balanceOf(investor.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
      const position = await vaultManager.getPosition(0, investor.address);
      expect(position.shares).to.equal(ethers.parseUnits("1000", USDT_DECIMALS));
    });

    it("should allow full withdrawal", async function () {
      const position = await vaultManager.getPosition(0, investor.address);
      const balanceBefore = await stablecoin.balanceOf(investor.address);
      await vaultManager.connect(investor).withdraw(0, position.shares, 0);
      const balanceAfter = await stablecoin.balanceOf(investor.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
      const updatedPosition = await vaultManager.getPosition(0, investor.address);
      expect(updatedPosition.shares).to.equal(0);
      expect(updatedPosition.depositedAmount).to.equal(0);
    });

    it("should reject withdrawal with insufficient shares", async function () {
      await expect(
        vaultManager.connect(investor).withdraw(0, ethers.parseUnits("9999", USDT_DECIMALS), 0)
      ).to.be.revertedWith("VM: insufficient shares");
    });

    it("should reject withdrawal when paused", async function () {
      await vaultManager.connect(owner).pause();
      await expect(
        vaultManager.connect(investor).withdraw(0, ethers.parseUnits("1000", USDT_DECIMALS), 0)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Rebalancing", function () {
    beforeEach(async function () {
      await vaultManager.connect(investor).deposit(0, ethers.parseUnits("10000", USDT_DECIMALS), 0);
    });

    it("should allow agent to rebalance", async function () {
      const amount = ethers.parseUnits("1000", USDT_DECIMALS);
      await vaultManager.connect(agent).rebalance(0, 1, amount);

      const fromVault = await vaultManager.vaults(0);
      const toVault = await vaultManager.vaults(1);

      expect(fromVault.totalDeposits).to.equal(ethers.parseUnits("9000", USDT_DECIMALS));
      expect(toVault.totalDeposits).to.equal(amount);
    });

    it("should reject rebalance from non-agent", async function () {
      await expect(
        vaultManager.connect(user).rebalance(0, 1, ethers.parseUnits("1000", USDT_DECIMALS))
      ).to.be.reverted;
    });

    it("should reject rebalance when paused", async function () {
      await vaultManager.connect(owner).pause();
      await expect(
        vaultManager.connect(agent).rebalance(0, 1, ethers.parseUnits("1000", USDT_DECIMALS))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should reject rebalance exceeding available liquidity", async function () {
      await expect(
        vaultManager.connect(agent).rebalance(0, 1, ethers.parseUnits("99999", USDT_DECIMALS))
      ).to.be.revertedWith("VM: insufficient liquidity");
    });

    it("should reject rebalance to same tier", async function () {
      await expect(
        vaultManager.connect(agent).rebalance(0, 0, ethers.parseUnits("1000", USDT_DECIMALS))
      ).to.be.revertedWith("VM: same tier");
    });
  });

  describe("Vault queries", function () {
    beforeEach(async function () {
      await vaultManager.connect(investor).deposit(0, ethers.parseUnits("5000", USDT_DECIMALS), 0);
      await vaultManager.connect(investor).deposit(1, ethers.parseUnits("3000", USDT_DECIMALS), 0);
      await vaultManager.connect(investor).deposit(2, ethers.parseUnits("2000", USDT_DECIMALS), 0);
    });

    it("should return free liquidity", async function () {
      const total = await vaultManager.getFreeLiquidity();
      expect(total).to.equal(ethers.parseUnits("10000", USDT_DECIMALS));
    });

    it("should return vault state", async function () {
      const [tvl, utilization, apy] = await vaultManager.getVaultState(0);
      expect(tvl).to.equal(ethers.parseUnits("5000", USDT_DECIMALS));
      expect(utilization).to.equal(0);
      expect(apy).to.equal(0);
    });

    it("should return available liquidity", async function () {
      const available = await vaultManager.getAvailableLiquidity(0);
      expect(available).to.equal(ethers.parseUnits("5000", USDT_DECIMALS));
    });
  });

  describe("Pause", function () {
    it("should only allow owner to pause", async function () {
      await expect(
        vaultManager.connect(user).pause()
      ).to.be.reverted;
      await vaultManager.connect(owner).pause();
      expect(await vaultManager.paused()).to.be.true;
    });

    it("should emit event on pause", async function () {
      await expect(vaultManager.connect(owner).pause())
        .to.emit(vaultManager, "Paused");
    });
  });
});
