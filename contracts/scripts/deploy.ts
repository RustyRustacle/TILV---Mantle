import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const network = process.env.HARDHAT_NETWORK || "mantleTestnet";
  const isMainnet = network === "mantleMainnet";

  console.log(`Deploying TILV Contracts to ${network}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MNT\n");

  // 1. Deploy InvoiceNFT
  console.log("Deploying InvoiceNFT...");
  const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
  const invoiceNFT = await InvoiceNFT.deploy();
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log("InvoiceNFT deployed to:", invoiceNFTAddress);

  // 2. Deploy RiskEngine
  console.log("\nDeploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy();
  await riskEngine.waitForDeployment();
  const riskEngineAddress = await riskEngine.getAddress();
  console.log("RiskEngine deployed to:", riskEngineAddress);

  // 3. Deploy VaultManager
  const USDT_ADDRESS = isMainnet
    ? (process.env.USDT_MAINNET_ADDRESS || "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE")
    : (process.env.USDT_ADDRESS || "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE");

  console.log("\nDeploying VaultManager...");
  console.log("Using USDT at:", USDT_ADDRESS);
  const VaultManager = await ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(USDT_ADDRESS, invoiceNFTAddress);
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("VaultManager deployed to:", vaultManagerAddress);

  // 4. Deploy ERC-8004 Registries
  console.log("\nDeploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityRegistryAddress);

  console.log("\nDeploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  const reputationRegistryAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationRegistryAddress);

  console.log("\nDeploying ValidationRegistry...");
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy();
  await validationRegistry.waitForDeployment();
  const validationRegistryAddress = await validationRegistry.getAddress();
  console.log("ValidationRegistry deployed to:", validationRegistryAddress);

  const validatorAddress = deployer.address;

  // Generate dedicated agent signer wallet if not provided
  const agentSigner = process.env.AGENT_SIGNER_PRIVATE_KEY
    ? new ethers.Wallet(process.env.AGENT_SIGNER_PRIVATE_KEY)
    : ethers.Wallet.createRandom();
  console.log("\nAgent Signer Wallet:", agentSigner.address);

  // 5. Deploy AgentController
  console.log("\nDeploying AgentController...");
  const AgentController = await ethers.getContractFactory("AgentController");
  const agentController = await AgentController.deploy(
    identityRegistryAddress,
    reputationRegistryAddress,
    validationRegistryAddress,
    vaultManagerAddress,
    riskEngineAddress,
    validatorAddress,
    agentSigner.address
  );
  await agentController.waitForDeployment();
  const agentControllerAddress = await agentController.getAddress();
  console.log("AgentController deployed to:", agentControllerAddress);

  // 6. Configure roles
  console.log("\nConfiguring roles...");

  const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
  await invoiceNFT.grantRole(MINTER_ROLE, vaultManagerAddress);
  console.log("Granted MINTER_ROLE to VaultManager");

  const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();
  await invoiceNFT.grantRole(VALIDATOR_ROLE, vaultManagerAddress);
  console.log("Granted VALIDATOR_ROLE to VaultManager");

  // Authorize AgentController on ValidationRegistry and ReputationRegistry
  await validationRegistry.authorizeRequester(agentControllerAddress);
  console.log("Authorized AgentController on ValidationRegistry");

  await reputationRegistry.authorizeSubmitter(agentControllerAddress);
  console.log("Authorized AgentController on ReputationRegistry");

  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  await vaultManager.grantRole(AGENT_ROLE, agentControllerAddress);
  console.log("Granted AGENT_ROLE to AgentController");

  // 7. Register agent
  console.log("\nRegistering agent...");
  const agentURI = "data:application/json," + JSON.stringify({
    name: "TILV Yield Optimizer",
    version: "1.0.0",
    network: network,
    vaultManager: vaultManagerAddress,
    riskEngine: riskEngineAddress
  });
  await agentController.registerAgent(agentURI);
  console.log("Agent registered with URI");

  const deploymentInfo = {
    network: network,
    deployedAt: new Date().toISOString(),
    contracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
      agentController: agentControllerAddress,
      identityRegistry: identityRegistryAddress,
      reputationRegistry: reputationRegistryAddress,
      validationRegistry: validationRegistryAddress,
      usdt: USDT_ADDRESS
    },
    deployer: deployer.address,
    agentSigner: agentSigner.address,
    agentSignerPrivateKey: process.env.AGENT_SIGNER_PRIVATE_KEY ? "[provided]" : agentSigner.privateKey,
    nextSteps: [
      "For production: deploy real zkML/TEE validator",
      "Upload agent_registration.json to IPFS",
      "Update agent URI with IPFS CID",
      "Verify all contracts on explorer",
      "Fund the agent signer wallet with MNT for gas"
    ]
  };

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\nDeployment Summary:\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
