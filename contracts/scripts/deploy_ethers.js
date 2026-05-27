const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const RPC = "https://rpc.mantle.xyz";
const USDT = "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Deployer:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "MNT\n");

  // Reuse existing mock registries
  const identityRegistryAddress = "0xd1e1837A45c75a2e1Be2800f380950cCe373ad5a";
  const reputationRegistryAddress = "0x4dE534158840Af1e8cFA1862F926F79FD772A519";
  const validationRegistryAddress = "0xBA3530d53d2AabF2538Bf880dA4B8e74933567b6";

  function load(name) {
    return JSON.parse(fs.readFileSync(`./artifacts/src/${name}.sol/${name}.json`, "utf8"));
  }

  // 1. InvoiceNFT
  console.log("Deploying InvoiceNFT...");
  const invoiceNFT = await new ethers.ContractFactory(load("InvoiceNFT").abi, load("InvoiceNFT").bytecode, wallet).deploy();
  await invoiceNFT.waitForDeployment();
  const invoiceNFTAddress = await invoiceNFT.getAddress();
  console.log("InvoiceNFT:", invoiceNFTAddress);

  // 2. RiskEngine
  console.log("\nDeploying RiskEngine...");
  const riskEngine = await new ethers.ContractFactory(load("RiskEngine").abi, load("RiskEngine").bytecode, wallet).deploy();
  await riskEngine.waitForDeployment();
  const riskEngineAddress = await riskEngine.getAddress();
  console.log("RiskEngine:", riskEngineAddress);

  // 3. VaultManager
  console.log("\nDeploying VaultManager...");
  const vaultManager = await new ethers.ContractFactory(load("VaultManager").abi, load("VaultManager").bytecode, wallet).deploy(USDT, invoiceNFTAddress);
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("VaultManager:", vaultManagerAddress);

  // 4. AgentController
  console.log("\nDeploying AgentController...");
  const agentController = await new ethers.ContractFactory(load("AgentController").abi, load("AgentController").bytecode, wallet).deploy(
    identityRegistryAddress,
    reputationRegistryAddress,
    validationRegistryAddress,
    vaultManagerAddress,
    riskEngineAddress,
    wallet.address,
    wallet.address
  );
  await agentController.waitForDeployment();
  const agentControllerAddress = await agentController.getAddress();
  console.log("AgentController:", agentControllerAddress);

  // 5. Grant MINTER_ROLE + VALIDATOR_ROLE on InvoiceNFT to VaultManager
  console.log("\nConfiguring roles...");
  const inv = new ethers.Contract(invoiceNFTAddress, load("InvoiceNFT").abi, wallet);
  const MINTER_ROLE = await inv.MINTER_ROLE();
  let tx = await inv.grantRole(MINTER_ROLE, vaultManagerAddress);
  await tx.wait();
  console.log("MINTER_ROLE granted");

  const VALIDATOR_ROLE = await inv.VALIDATOR_ROLE();
  tx = await inv.grantRole(VALIDATOR_ROLE, vaultManagerAddress);
  await tx.wait();
  console.log("VALIDATOR_ROLE granted");

  // 6. Grant AGENT_ROLE to AgentController
  const vm = new ethers.Contract(vaultManagerAddress, load("VaultManager").abi, wallet);
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  tx = await vm.grantRole(AGENT_ROLE, agentControllerAddress);
  await tx.wait();
  console.log("AGENT_ROLE granted to AgentController");

  // 7. Register agent
  const ac = new ethers.Contract(agentControllerAddress, load("AgentController").abi, wallet);
  const agentURI = "data:application/json," + JSON.stringify({
    name: "TILV Yield Optimizer",
    version: "1.0.0",
    network: "mantleMainnet",
    vaultManager: vaultManagerAddress,
    riskEngine: riskEngineAddress
  });
  tx = await ac.registerAgent(agentURI);
  await tx.wait();
  console.log("Agent registered");

  // 8. Save deployment info
  const info = {
    network: "mantleMainnet",
    deployedAt: new Date().toISOString(),
    contracts: {
      invoiceNFT: invoiceNFTAddress,
      riskEngine: riskEngineAddress,
      vaultManager: vaultManagerAddress,
      agentController: agentControllerAddress,
      mockIdentityRegistry: identityRegistryAddress,
      mockReputationRegistry: reputationRegistryAddress,
      mockValidationRegistry: validationRegistryAddress,
      usdt: USDT,
    },
    deployer: wallet.address,
  };

  fs.writeFileSync("deploy_fresh.json", JSON.stringify(info, null, 2));
  console.log("\n" + "=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log(JSON.stringify(info, null, 2));
  console.log("\nSaved to deploy_fresh.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
