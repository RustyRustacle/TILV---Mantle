const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

require("ts-node/register");

const {
  applyPlaceholders,
  assertNoUnresolvedPlaceholders,
  buildAgentUri,
} = require("../scripts/agent_metadata");

describe("Agent metadata publishing", function () {
  it("keeps public/agent.json aligned with the verified Mantle mainnet deployment", function () {
    const agentPath = path.join(__dirname, "..", "..", "public", "agent.json");
    const metadata = JSON.parse(fs.readFileSync(agentPath, "utf8"));

    expect(metadata.type).to.equal("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(metadata.name).to.equal("TILV Yield Optimizer");
    expect(metadata.registrations[0].agentId).to.equal("0");
    expect(metadata.registrations[0].agentRegistry).to.equal(
      "eip155:5000:0xFa2786449B5020bCf2C8bdD7e458D9cCC76F1f1b"
    );
    expect(metadata.tilv.contracts.agentController).to.equal(
      "0x42E1DDa459F2c38AdEefd82DA0C9cc1373bFdDBF"
    );
    expect(metadata.tilv.contracts.identityRegistry).to.equal(
      "0xFa2786449B5020bCf2C8bdD7e458D9cCC76F1f1b"
    );
    expect(metadata.tilv.contracts.vaultManager).to.equal(
      "0x8FafC9dAc6342310fFd87497aCa9D405142EaA6D"
    );
    expect(metadata.tilv.contracts.riskEngine).to.equal(
      "0x95768Da9D39E4D9E1B1E7C76F7091ceeb6404Ddd"
    );
  });

  it("substitutes placeholders, rejects unresolved values, and builds an IPFS URI", function () {
    const metadata = {
      registrations: [
        {
          agentId: "{AGENT_ID}",
          agentRegistry: "eip155:5000:{IDENTITY_REGISTRY_ADDRESS}",
        },
      ],
      tilv: {
        contracts: {
          agentController: "{AGENT_CONTROLLER_ADDRESS}",
        },
      },
    };

    const resolved = applyPlaceholders(metadata, {
      AGENT_ID: "0",
      IDENTITY_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
      AGENT_CONTROLLER_ADDRESS: "0x2222222222222222222222222222222222222222",
    });

    expect(resolved.registrations[0].agentId).to.equal("0");
    expect(resolved.registrations[0].agentRegistry).to.equal(
      "eip155:5000:0x1111111111111111111111111111111111111111"
    );
    expect(resolved.tilv.contracts.agentController).to.equal(
      "0x2222222222222222222222222222222222222222"
    );
    expect(() => assertNoUnresolvedPlaceholders(resolved)).not.to.throw();
    expect(buildAgentUri("bafybeigdyrzt")).to.equal("ipfs://bafybeigdyrzt");
  });
});
