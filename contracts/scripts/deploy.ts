import { ethers, network } from "hardhat";

async function main() {
  console.log("🚀 Deploying TILV Contracts to Mantle Network...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MNT\n");

  // 1. Deploy InvoiceNFT
  console.log("📝 Deploying InvoiceNFT...");
  const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
  const invoiceNFT = await InvoiceNFT.deploy();
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log("✅  InvoiceNFT deployed to:", invoiceNFTAddress);

  // 2. Deploy RiskEngine
  console.log("\n⚖️  Deploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy();
  await riskEngine.waitForDeployment();
  const riskEngineAddress = await riskEngine.getAddress();
  console.log("✅ RiskEngine deployed to:", riskEngineAddress);

  // 3. Deploy VaultManager
  // Mantle USDT address. Override with USDT_ADDRESS if needed.
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE";

  console.log("\n💰 Deploying VaultManager...");
  console.log("Using USDT at:", USDT_ADDRESS);
  const VaultManager = await ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(USDT_ADDRESS, invoiceNFTAddress);
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("✅ VaultManager deployed to:", vaultManagerAddress);

  // 4. Configure roles and permissions
  console.log("\n🔐 Configuring roles and permissions...");

  // Grant MINTER_ROLE to VaultManager
  const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
  await invoiceNFT.grantRole(MINTER_ROLE, vaultManagerAddress);
  console.log("✅ Granted MINTER_ROLE to VaultManager");

  // Grant VALIDATOR_ROLE to deployer (for demo purposes)
  const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();
  await invoiceNFT.grantRole(VALIDATOR_ROLE, deployer.address);
  console.log("✅ Granted VALIDATOR_ROLE to deployer");

  // 5. Save deployment addresses
  const deploymentInfo = {
    network: network.name,
    deployedAt: new Date().toISOString(),
    contracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
      usdt: USDT_ADDRESS
    },
    deployer: deployer.address
  };

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Deployment Summary:\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📝 Next Steps:");
  console.log("1. Update .env files with contract addresses");
  console.log("2. Verify contracts on Mantle Explorer");
  console.log("3. Fund VaultManager with USDT for testing\n");

  // Save to file
  const fs = require("fs");
  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("💾 Deployment info saved to deployment.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
