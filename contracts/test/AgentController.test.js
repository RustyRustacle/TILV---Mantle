const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentController", function () {
  let agentController, vaultManager, riskEngine, owner, agentSigner, validatorAddr, user;
  let identityRegistry, reputationRegistry, validationRegistry;

  beforeEach(async function () {
    [owner, agentSigner, validatorAddr, user] = await ethers.getSigners();

    const IdentityFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityFactory.deploy();
    await identityRegistry.waitForDeployment();

    const ReputationFactory = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationFactory.deploy();
    await reputationRegistry.waitForDeployment();

    const ValidationFactory = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationFactory.deploy();
    await validationRegistry.waitForDeployment();

    const Stablecoin = await ethers.getContractFactory("MockERC20");
    const stablecoin = await Stablecoin.deploy("USDT", "USDT", 6);
    await stablecoin.waitForDeployment();

    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    const invoiceNFT = await InvoiceNFT.deploy();
    await invoiceNFT.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy(
      await stablecoin.getAddress(),
      await invoiceNFT.getAddress()
    );
    await vaultManager.waitForDeployment();

    const RiskEngine = await ethers.getContractFactory("RiskEngine");
    riskEngine = await RiskEngine.deploy();
    await riskEngine.waitForDeployment();

    const AgentController = await ethers.getContractFactory("AgentController");
    agentController = await AgentController.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await validationRegistry.getAddress(),
      await vaultManager.getAddress(),
      await riskEngine.getAddress(),
      validatorAddr.address,
      agentSigner.address
    );
    await agentController.waitForDeployment();

    const AGENT_ROLE = await vaultManager.AGENT_ROLE();
    await vaultManager.grantRole(AGENT_ROLE, await agentController.getAddress());
  });

  describe("Deployment", function () {
    it("should set constructor params correctly", async function () {
      expect(await agentController.agentSigner()).to.equal(agentSigner.address);
      expect(await agentController.validatorAddress()).to.equal(validatorAddr.address);
      expect(await agentController.vaultManager()).to.equal(await vaultManager.getAddress());
      expect(await agentController.riskEngine()).to.equal(await riskEngine.getAddress());
    });

    it("should set default safety params", async function () {
      expect(await agentController.maxRebalanceBps()).to.equal(2000);
      expect(await agentController.cooldownPeriod()).to.equal(6 * 3600);
      expect(await agentController.validationTimeout()).to.equal(30 * 60);
      expect(await agentController.paused()).to.be.false;
    });
  });

  describe("Agent Registration", function () {
    it("should register agent", async function () {
      await agentController.connect(owner).registerAgent("ipfs://agent-uri");
      expect(await agentController.agentRegistered()).to.be.true;
      expect(await agentController.agentId()).to.equal(ethers.toBigInt(0));
    });

    it("should reject registration by non-owner", async function () {
      await expect(
        agentController.connect(user).registerAgent("ipfs://agent-uri")
      ).to.be.reverted;
    });

    it("should reject double registration", async function () {
      await agentController.connect(owner).registerAgent("ipfs://agent-uri");
      await expect(
        agentController.connect(owner).registerAgent("ipfs://agent-uri-2")
      ).to.be.revertedWith("AC: already registered");
    });
  });

  describe("Proposal Submission", function () {
    beforeEach(async function () {
      await agentController.connect(owner).registerAgent("ipfs://agent-uri");

      const stablecoin = await ethers.getContractAt("MockERC20",
        await vaultManager.stablecoin()
      );
      await stablecoin.mint(owner.address, ethers.parseUnits("100000", 6));
      await stablecoin.connect(owner).approve(
        await vaultManager.getAddress(),
        ethers.parseUnits("100000", 6)
      );
      await vaultManager.connect(owner).deposit(0, ethers.parseUnits("50000", 6));
    });

    it("should accept proposal from agent signer", async function () {
      const fromTier = 0;
      const toTier = 1;
      const amount = ethers.parseUnits("1000", 6);
      const nonce = 1;
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [fromTier, toTier, amount, nonce, agentSigner.address]
      );
      const requestHash = ethers.keccak256(encoded);

      await expect(
        agentController.connect(agentSigner).submitProposal(
          fromTier, toTier, amount, nonce, "data:reasoning", requestHash
        )
      ).to.emit(agentController, "ProposalSubmitted");
    });

    it("should reject proposal from non-signer", async function () {
      const requestHash = ethers.randomBytes(32);
      await expect(
        agentController.connect(user).submitProposal(
          0, 1, ethers.parseUnits("1000", 6), 1, "data:reasoning", requestHash
        )
      ).to.be.revertedWith("AC: not agent signer");
    });

    it("should reject duplicate proposal hash", async function () {
      const fromTier = 0;
      const toTier = 1;
      const amount = ethers.parseUnits("1000", 6);
      const nonce = 1;
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [fromTier, toTier, amount, nonce, agentSigner.address]
      );
      const requestHash = ethers.keccak256(encoded);

      await agentController.connect(agentSigner).submitProposal(
        fromTier, toTier, amount, nonce, "data:reasoning", requestHash
      );
      await expect(
        agentController.connect(agentSigner).submitProposal(
          fromTier, toTier, amount, nonce, "data:reasoning", requestHash
        )
      ).to.be.revertedWith("AC: duplicate hash");
    });

    it("should reject when paused", async function () {
      await agentController.connect(owner).pause();
      const requestHash = ethers.randomBytes(32);
      await expect(
        agentController.connect(agentSigner).submitProposal(
          0, 1, ethers.parseUnits("1000", 6), 1, "data:reasoning", requestHash
        )
      ).to.be.revertedWith("AC: paused");
    });

    it("should reject invalid tiers", async function () {
      const requestHash = ethers.randomBytes(32);
      await expect(
        agentController.connect(agentSigner).submitProposal(
          3, 1, 1000, 1, "data:reasoning", requestHash
        )
      ).to.be.revertedWith("AC: invalid tier");
    });

    it("should reject same tiers", async function () {
      const requestHash = ethers.randomBytes(32);
      await expect(
        agentController.connect(agentSigner).submitProposal(
          1, 1, 1000, 1, "data:reasoning", requestHash
        )
      ).to.be.revertedWith("AC: same tier");
    });

    it("should reject proposal before agent registration", async function () {
      const AgentController = await ethers.getContractFactory("AgentController");
      const ac = await AgentController.deploy(
        await identityRegistry.getAddress(),
        await reputationRegistry.getAddress(),
        await validationRegistry.getAddress(),
        await vaultManager.getAddress(),
        await riskEngine.getAddress(),
        validatorAddr.address,
        agentSigner.address
      );
      await ac.waitForDeployment();

      const requestHash = ethers.randomBytes(32);
      await expect(
        ac.connect(agentSigner).submitProposal(0, 1, 1000, 1, "data:reasoning", requestHash)
      ).to.be.revertedWith("AC: agent not registered");
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      await agentController.connect(owner).registerAgent("ipfs://agent-uri");

      const stablecoin = await ethers.getContractAt("MockERC20",
        await vaultManager.stablecoin()
      );
      const investor = owner;
      await stablecoin.mint(investor.address, ethers.parseUnits("10000", 6));
      await stablecoin.connect(investor).approve(
        await vaultManager.getAddress(),
        ethers.parseUnits("10000", 6)
      );
      await vaultManager.connect(investor).deposit(0, ethers.parseUnits("5000", 6));
    });

    it("should execute a validated proposal", async function () {
      const fromTier = 0;
      const toTier = 1;
      const amount = ethers.parseUnits("1000", 6);
      const nonce = 1;
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [fromTier, toTier, amount, nonce, agentSigner.address]
      );
      const requestHash = ethers.keccak256(encoded);

      await agentController.connect(agentSigner).submitProposal(
        fromTier, toTier, amount, nonce, "data:reasoning", requestHash
      );

      // Validator provides response through ValidationRegistry
      await validationRegistry.connect(validatorAddr).validationResponse(
        requestHash, 100, "", ethers.ZeroHash, "yield-optimization"
      );

      await expect(
        agentController.connect(user).executeProposal(requestHash)
      ).to.emit(agentController, "ProposalExecuted");
    });

    it("should reject execution when validation score too low", async function () {
      const fromTier = 0;
      const toTier = 1;
      const amount = ethers.parseUnits("1000", 6);
      const nonce = 1;
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [fromTier, toTier, amount, nonce, agentSigner.address]
      );
      const requestHash = ethers.keccak256(encoded);

      await agentController.connect(agentSigner).submitProposal(
        fromTier, toTier, amount, nonce, "data:reasoning", requestHash
      );

      // Validator gives score 50 (below threshold of 70)
      await validationRegistry.connect(validatorAddr).validationResponse(
        requestHash, 50, "", ethers.ZeroHash, "yield-optimization"
      );

      await expect(
        agentController.connect(user).executeProposal(requestHash)
      ).to.be.revertedWith("AC: validation failed");
    });

    it("should reject execution of expired proposal", async function () {
      const fromTier = 0;
      const toTier = 1;
      const amount = 100;
      const nonce = 1;
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [fromTier, toTier, amount, nonce, agentSigner.address]
      );
      const requestHash = ethers.keccak256(encoded);
      await agentController.connect(agentSigner).submitProposal(
        fromTier, toTier, amount, nonce, "data:reasoning", requestHash
      );

      await ethers.provider.send("evm_increaseTime", [31 * 60]);
      await ethers.provider.send("evm_mine");

      await expect(
        agentController.connect(user).executeProposal(requestHash)
      ).to.be.revertedWith("AC: proposal expired");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set agent signer", async function () {
      await agentController.connect(owner).setAgentSigner(user.address);
      expect(await agentController.agentSigner()).to.equal(user.address);
    });

    it("should allow owner to set max rebalance bps", async function () {
      await agentController.connect(owner).setMaxRebalanceBps(3000);
      expect(await agentController.maxRebalanceBps()).to.equal(3000);
    });

    it("should reject max rebalance > 50%", async function () {
      await expect(
        agentController.connect(owner).setMaxRebalanceBps(5001)
      ).to.be.revertedWith("AC: max 50%");
    });

    it("should allow owner to pause and unpause", async function () {
      await agentController.connect(owner).pause();
      expect(await agentController.paused()).to.be.true;
      await agentController.connect(owner).unpause();
      expect(await agentController.paused()).to.be.false;
    });

    it("should reject non-owner admin functions", async function () {
      await expect(
        agentController.connect(user).pause()
      ).to.be.reverted;
    });
  });
});
