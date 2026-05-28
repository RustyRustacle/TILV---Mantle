import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = process.env.HARDHAT_NETWORK || "mantleMainnet";
  console.log(`Deploying TILV Upgrade (ERC-8004) to ${network}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MNT\n");

  // Existing contract addresses from .env
  const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS || "0xd917C2A5B9340876844c63a5b31E74d6Fb00956d";
  const riskEngineAddress = process.env.RISK_ENGINE_ADDRESS || "0x7fad201FE34F0e0c55f44B75Ac482f76d77379DD";

  console.log("Existing VaultManager:", vaultManagerAddress);
  console.log("Existing RiskEngine:", riskEngineAddress);

  // 1. Deploy IdentityRegistry
  console.log("\nDeploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry:", identityRegistryAddress);

  // 2. Deploy ReputationRegistry
  console.log("\nDeploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  const reputationRegistryAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry:", reputationRegistryAddress);

  // 3. Deploy ValidationRegistry
  console.log("\nDeploying ValidationRegistry...");
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy();
  await validationRegistry.waitForDeployment();
  const validationRegistryAddress = await validationRegistry.getAddress();
  console.log("ValidationRegistry:", validationRegistryAddress);

  const validatorAddress = deployer.address;

  // 4. Deploy AgentController
  console.log("\nDeploying AgentController...");
  const AgentController = await ethers.getContractFactory("AgentController");
  const agentController = await AgentController.deploy(
    identityRegistryAddress,
    reputationRegistryAddress,
    validationRegistryAddress,
    vaultManagerAddress,
    riskEngineAddress,
    validatorAddress,
    deployer.address // agentSigner = deployer for now
  );
  await agentController.waitForDeployment();
  const agentControllerAddress = await agentController.getAddress();
  console.log("AgentController:", agentControllerAddress);

  // 5. Grant AGENT_ROLE to AgentController on VaultManager
  console.log("\nGranting AGENT_ROLE to AgentController...");
  const vaultManager = await ethers.getContractAt("VaultManager", vaultManagerAddress);
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  const tx = await vaultManager.grantRole(AGENT_ROLE, agentControllerAddress);
  await tx.wait();
  console.log("AGENT_ROLE granted to AgentController");

  // 6. Register agent
  console.log("\nRegistering agent...");
  const agentURI = "data:application/json," + JSON.stringify({
    name: "TILV Yield Optimizer",
    version: "1.0.0",
    network: network,
    vaultManager: vaultManagerAddress,
    riskEngine: riskEngineAddress
  });
  const registerTx = await agentController.registerAgent(agentURI);
  await registerTx.wait();
  console.log("Agent registered");

  // 7. Grant MINTER_ROLE and VALIDATOR_ROLE on InvoiceNFT to VaultManager (if not already)
  console.log("\nChecking InvoiceNFT roles...");
  const invoiceNFTAddress = process.env.INVOICE_NFT_ADDRESS || "0xC7af423cB2B4E7F1095a7229CB1cd765BD02711B";
  const invoiceNFT = await ethers.getContractAt("InvoiceNFT", invoiceNFTAddress);
  const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
  const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();

  const hasMinter = await invoiceNFT.hasRole(MINTER_ROLE, vaultManagerAddress);
  if (!hasMinter) {
    const tx2 = await invoiceNFT.grantRole(MINTER_ROLE, vaultManagerAddress);
    await tx2.wait();
    console.log("Granted MINTER_ROLE to VaultManager");
  } else {
    console.log("MINTER_ROLE already granted");
  }

  const hasValidator = await invoiceNFT.hasRole(VALIDATOR_ROLE, vaultManagerAddress);
  if (!hasValidator) {
    const tx3 = await invoiceNFT.grantRole(VALIDATOR_ROLE, vaultManagerAddress);
    await tx3.wait();
    console.log("Granted VALIDATOR_ROLE to VaultManager");
  } else {
    console.log("VALIDATOR_ROLE already granted");
  }

  const deploymentInfo = {
    network: network,
    deployedAt: new Date().toISOString(),
    contracts: {
      identityRegistry: identityRegistryAddress,
      reputationRegistry: reputationRegistryAddress,
      validationRegistry: validationRegistryAddress,
      agentController: agentControllerAddress,
    },
    existingContracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
    },
    deployer: deployer.address,
  };

  console.log("\n" + "=".repeat(60));
  console.log("Upgrade Deployment Complete!");
  console.log("=".repeat(60));
  console.log(JSON.stringify(deploymentInfo, null, 2));

  fs.writeFileSync(
    "deploy_upgrade.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deploy_upgrade.json\n");

  console.log("\nNext steps:");
  console.log(`1. Update .env with these addresses`);
  console.log(`2. Set AGENT_SIGNER_ADDRESS to the yield optimizer wallet`);
  console.log(`3. Deploy yield_optimizer.py with updated .env`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
