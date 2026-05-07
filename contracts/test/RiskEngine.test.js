const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RiskEngine", function () {
  let riskEngine, owner, oracle, user;

  beforeEach(async function () {
    [owner, oracle, user] = await ethers.getSigners();
    const RiskEngine = await ethers.getContractFactory("RiskEngine");
    riskEngine = await RiskEngine.deploy();
    await riskEngine.waitForDeployment();

    await riskEngine.connect(owner).authorizeOracle(oracle.address);
  });

  describe("Deployment", function () {
    it("should authorize owner as oracle", async function () {
      expect(await riskEngine.authorizedOracles(owner.address)).to.be.true;
    });

    it("should set default validity period", async function () {
      expect(await riskEngine.assessmentValidityPeriod()).to.equal(30 * 86400);
    });
  });

  describe("Oracle Management", function () {
    it("should allow owner to authorize oracle", async function () {
      expect(await riskEngine.authorizedOracles(oracle.address)).to.be.true;
    });

    it("should allow owner to revoke oracle", async function () {
      await riskEngine.connect(owner).revokeOracle(oracle.address);
      expect(await riskEngine.authorizedOracles(oracle.address)).to.be.false;
    });

    it("should reject duplicate authorization", async function () {
      await expect(
        riskEngine.connect(owner).authorizeOracle(oracle.address)
      ).to.be.revertedWith("Already authorized");
    });

    it("should reject non-owner oracle management", async function () {
      await expect(
        riskEngine.connect(user).authorizeOracle(user.address)
      ).to.be.reverted;
    });
  });

  describe("Risk Assessment", function () {
    it("should submit assessment", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      const assessment = await riskEngine.getRiskAssessment(1);
      expect(assessment.score).to.equal(25);
      expect(assessment.tier).to.equal(0); // Prime
      expect(assessment.isValid).to.be.true;
    });

    it("should assign correct tier based on score", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      let a = await riskEngine.getRiskAssessment(1);
      expect(a.tier).to.equal(0); // Prime

      await riskEngine.connect(oracle).submitRiskAssessment(2, 45);
      a = await riskEngine.getRiskAssessment(2);
      expect(a.tier).to.equal(1); // Growth

      await riskEngine.connect(oracle).submitRiskAssessment(3, 75);
      a = await riskEngine.getRiskAssessment(3);
      expect(a.tier).to.equal(2); // Emerging

      await riskEngine.connect(oracle).submitRiskAssessment(4, 100);
      a = await riskEngine.getRiskAssessment(4);
      expect(a.tier).to.equal(2);
    });

    it("should reject existing valid assessment", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      await expect(
        riskEngine.connect(oracle).submitRiskAssessment(1, 30)
      ).to.be.revertedWith("Assessment already exists");
    });

    it("should allow new assessment after invalidation", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      await riskEngine.connect(oracle).invalidateAssessment(1);
      await riskEngine.connect(oracle).submitRiskAssessment(1, 30);
      const assessment = await riskEngine.getRiskAssessment(1);
      expect(assessment.score).to.equal(30);
    });

    it("should reject non-oracle assessment submission", async function () {
      await expect(
        riskEngine.connect(user).submitRiskAssessment(1, 25)
      ).to.be.revertedWith("Not an authorized oracle");
    });

    it("should reject score > 100", async function () {
      await expect(
        riskEngine.connect(oracle).submitRiskAssessment(1, 101)
      ).to.be.revertedWith("Score must be <= 100");
    });
  });

  describe("Assessment Validity", function () {
    it("should expire after validity period", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      expect(await riskEngine.isAssessmentValid(1)).to.be.true;

      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await riskEngine.isAssessmentValid(1)).to.be.false;
    });

    it("should return false after invalidation", async function () {
      await riskEngine.connect(oracle).submitRiskAssessment(1, 25);
      await riskEngine.connect(oracle).invalidateAssessment(1);
      expect(await riskEngine.isAssessmentValid(1)).to.be.false;
    });
  });
});
