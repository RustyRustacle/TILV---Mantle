import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const network = process.env.HARDHAT_NETWORK || "mantleMainnet";
  console.log(`Deploying TILV Fresh (mainnet-ready) to ${network}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MNT\n");

  const USDT_ADDRESS = "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE";

  // Reuse already-deployed mock registries
  const identityRegistryAddress = "0xd1e1837A45c75a2e1Be2800f380950cCe373ad5a";
  const reputationRegistryAddress = "0x4dE534158840Af1e8cFA1862F926F79FD772A519";
  const validationRegistryAddress = "0xBA3530d53d2AabF2538Bf880dA4B8e74933567b6";

  console.log("Using USDT:", USDT_ADDRESS);
  console.log("Using MockIdentityRegistry:", identityRegistryAddress);
  console.log("Using MockReputationRegistry:", reputationRegistryAddress);
  console.log("Using MockValidationRegistry:", validationRegistryAddress);

  // 1. Deploy InvoiceNFT
  console.log("\nDeploying InvoiceNFT...");
  const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
  const invoiceNFT = await InvoiceNFT.deploy({
    gasLimit: 2000000,
    maxFeePerGas: ethers.parseUnits("60", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
  });
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log("InvoiceNFT:", invoiceNFTAddress);

  // 2. Deploy RiskEngine
  console.log("\nDeploying RiskEngine...");
  const RiskEngine = await ethers.getContractFactory("RiskEngine");
  const riskEngine = await RiskEngine.deploy({
    gasLimit: 1000000,
    maxFeePerGas: ethers.parseUnits("60", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
  });
  await riskEngine.waitForDeployment();
  const riskEngineAddress = await riskEngine.getAddress();
  console.log("RiskEngine:", riskEngineAddress);

  // 3. Deploy VaultManager (needs ~4M gas on Mantle)
  console.log("\nDeploying VaultManager...");
  const VMFactory = await ethers.getContractFactory("VaultManager");
  const vaultManager = await VMFactory.deploy(USDT_ADDRESS, invoiceNFTAddress, {
    gasLimit: 5000000,
    maxFeePerGas: ethers.parseUnits("60", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
  });
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("VaultManager:", vaultManagerAddress);

  const validatorAddress = deployer.address;
  const agentSigner = deployer.address;

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
    agentSigner,
    {
      gasLimit: 2000000,
      maxFeePerGas: ethers.parseUnits("60", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
    }
  );
  await agentController.waitForDeployment();
  const agentControllerAddress = await agentController.getAddress();
  console.log("AgentController:", agentControllerAddress);

  // 5. Grant roles on InvoiceNFT
  console.log("\nConfiguring InvoiceNFT roles...");
  const MINTER_ROLE = await invoiceNFT.MINTER_ROLE();
  let tx = await invoiceNFT.grantRole(MINTER_ROLE, vaultManagerAddress);
  await tx.wait();
  console.log("Granted MINTER_ROLE to VaultManager");

  const VALIDATOR_ROLE = await invoiceNFT.VALIDATOR_ROLE();
  tx = await invoiceNFT.grantRole(VALIDATOR_ROLE, vaultManagerAddress);
  await tx.wait();
  console.log("Granted VALIDATOR_ROLE to VaultManager");

  // 6. Grant AGENT_ROLE to AgentController on VaultManager
  console.log("\nGranting AGENT_ROLE to AgentController...");
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  tx = await vaultManager.grantRole(AGENT_ROLE, agentControllerAddress);
  await tx.wait();
  console.log("AGENT_ROLE granted to AgentController");

  // 7. Register agent
  console.log("\nRegistering agent...");
  const agentURI = "data:application/json," + JSON.stringify({
    name: "TILV Yield Optimizer",
    version: "1.0.0",
    network: network,
    vaultManager: vaultManagerAddress,
    riskEngine: riskEngineAddress
  });
  tx = await agentController.registerAgent(agentURI);
  await tx.wait();
  console.log("Agent registered");

  // 8. Save deployment info
  const deploymentInfo = {
    network: network,
    deployedAt: new Date().toISOString(),
    contracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
      agentController: agentControllerAddress,
      mockIdentityRegistry: identityRegistryAddress,
      mockReputationRegistry: reputationRegistryAddress,
      mockValidationRegistry: validationRegistryAddress,
      usdt: USDT_ADDRESS
    },
    deployer: deployer.address,
  };

  console.log("\n" + "=".repeat(60));
  console.log("Fresh Deployment Complete!");
  console.log("=".repeat(60));
  console.log(JSON.stringify(deploymentInfo, null, 2));

  fs.writeFileSync(
    "deploy_fresh.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deploy_fresh.json\n");
  console.log("Deployer:", deployer.address, "(keep safe for admin operations)\n");

  console.log("Add these to .env:");
  console.log(`INVOICE_NFT_ADDRESS=${invoiceNFTAddress}`);
  console.log(`VAULT_MANAGER_ADDRESS=${vaultManagerAddress}`);
  console.log(`RISK_ENGINE_ADDRESS=${riskEngineAddress}`);
  console.log(`AGENT_CONTROLLER_ADDRESS=${agentControllerAddress}`);
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`REPUTATION_REGISTRY_ADDRESS=${reputationRegistryAddress}`);
  console.log(`VALIDATION_REGISTRY_ADDRESS=${validationRegistryAddress}`);
  console.log(`VALIDATOR_ADDRESS=${validatorAddress}`);
  console.log(`AGENT_SIGNER_ADDRESS=${agentSigner}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
