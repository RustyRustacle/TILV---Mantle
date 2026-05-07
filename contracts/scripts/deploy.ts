import { ethers } from "hardhat";

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
    ? (process.env.USDT_MAINNET_ADDRESS || "")
    : (process.env.USDT_ADDRESS || "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE");

  console.log("\nDeploying VaultManager...");
  console.log("Using USDT at:", USDT_ADDRESS);
  const VaultManager = await ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(USDT_ADDRESS, invoiceNFTAddress);
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("VaultManager deployed to:", vaultManagerAddress);

  // 4. Configure roles
  console.log("\nConfiguring roles...");

  const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
  await invoiceNFT.grantRole(MINTER_ROLE, vaultManagerAddress);
  console.log("Granted MINTER_ROLE to VaultManager");

  const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();
  await invoiceNFT.grantRole(VALIDATOR_ROLE, deployer.address);
  console.log("Granted VALIDATOR_ROLE to deployer");

  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));

  console.log("\nNote: After deploying AgentController, grant AGENT_ROLE:");
  console.log(`  await vaultManager.grantRole("${AGENT_ROLE}", <AgentController address>);`);

  const deploymentInfo = {
    network: network,
    deployedAt: new Date().toISOString(),
    contracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
      usdt: USDT_ADDRESS
    },
    deployer: deployer.address,
    nextSteps: [
      "Deploy ERC-8004 registries (IdentityRegistry, ReputationRegistry, ValidationRegistry)",
      "Deploy AgentController with registry addresses",
      "Grant AGENT_ROLE on VaultManager to AgentController",
      "Deploy MockValidator for hackathon",
      "Verify all contracts on explorer"
    ]
  };

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\nDeployment Summary:\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  const fs = require("fs");
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
