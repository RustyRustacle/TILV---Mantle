import { ethers } from "hardhat";

const AGENT_CONTROLLER = "0x42E1DDa459F2c38AdEefd82DA0C9cc1373bFdDBF";
const NEW_AGENT_SIGNER = process.env.NEW_AGENT_SIGNER;

async function main() {
  if (!NEW_AGENT_SIGNER || !ethers.isAddress(NEW_AGENT_SIGNER)) {
    throw new Error("Set NEW_AGENT_SIGNER to a valid wallet address");
  }

  const [owner] = await ethers.getSigners();
  if (!owner) {
    throw new Error("No signer configured. Set PRIVATE_KEY in contracts/.env");
  }

  const controller = await ethers.getContractAt("AgentController", AGENT_CONTROLLER, owner);
  const current = await controller.agentSigner();

  console.log("Owner:", owner.address);
  console.log("AgentController:", AGENT_CONTROLLER);
  console.log("Current agentSigner:", current);
  console.log("New agentSigner:", NEW_AGENT_SIGNER);

  if (current.toLowerCase() === NEW_AGENT_SIGNER.toLowerCase()) {
    console.log("Agent signer already set. No transaction sent.");
    return;
  }

  const tx = await controller.setAgentSigner(NEW_AGENT_SIGNER);
  console.log("Transaction:", tx.hash);
  await tx.wait();

  const updated = await controller.agentSigner();
  console.log("Updated agentSigner:", updated);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
