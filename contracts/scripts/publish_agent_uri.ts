import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const {
  applyPlaceholders,
  assertNoUnresolvedPlaceholders,
  buildAgentUri,
  findUnresolvedPlaceholders,
  getPlaceholderValues,
} = require("./agent_metadata");

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface PinataResponse {
  IpfsHash?: string;
}

const UPDATE_AGENT_URI_ABI = [
  "function updateAgentURI(string newURI) external",
];

async function uploadJsonToPinata(metadata: JsonValue, jwt: string): Promise<string> {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: {
        name: "tilv-agent.json",
      },
      pinataContent: metadata,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as PinataResponse;
  if (!result.IpfsHash) {
    throw new Error(`Pinata response did not include IpfsHash: ${JSON.stringify(result)}`);
  }

  return result.IpfsHash;
}

async function main(): Promise<void> {
  const agentJsonPath = path.resolve(
    process.cwd(),
    process.env.AGENT_JSON_PATH ?? "../public/agent.json"
  );
  const rawMetadata = JSON.parse(fs.readFileSync(agentJsonPath, "utf8")) as JsonValue;
  const metadata = applyPlaceholders(rawMetadata, getPlaceholderValues(process.env));
  const unresolved = findUnresolvedPlaceholders(metadata);
  const allowPlaceholders = process.env.ALLOW_PLACEHOLDERS === "true";
  const dryRun = process.env.DRY_RUN === "true";

  if (!allowPlaceholders) {
    assertNoUnresolvedPlaceholders(metadata);
  } else if (unresolved.length > 0) {
    console.warn(`Leaving unresolved placeholders: ${unresolved.join(", ")}`);
  }

  console.log(`Network: ${network.name}`);
  console.log(`Agent JSON: ${agentJsonPath}`);
  console.log(`Payload bytes: ${Buffer.byteLength(JSON.stringify(metadata), "utf8")}`);

  if (dryRun) {
    console.log("DRY_RUN=true, skipping Pinata upload and on-chain update.");
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    throw new Error("PINATA_JWT is required unless DRY_RUN=true");
  }

  const agentControllerAddress = process.env.AGENT_CONTROLLER_ADDRESS;
  if (!agentControllerAddress) {
    throw new Error("AGENT_CONTROLLER_ADDRESS is required");
  }

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer available. Set PRIVATE_KEY for the selected Hardhat network.");
  }

  const cid = await uploadJsonToPinata(metadata, pinataJwt);
  const agentURI = buildAgentUri(cid);
  console.log(`CID: ${cid}`);
  console.log(`agentURI: ${agentURI}`);

  const agentController = await ethers.getContractAt(
    UPDATE_AGENT_URI_ABI,
    agentControllerAddress,
    signer
  );
  const tx = await agentController.updateAgentURI(agentURI);
  console.log(`Update tx: ${tx.hash}`);
  await tx.wait();
  console.log(`AgentController: ${agentControllerAddress}`);
  console.log("agentURI updated.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
