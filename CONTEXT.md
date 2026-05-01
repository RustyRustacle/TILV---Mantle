# TILV — Project Context for Claude Code

## What is TILV

TILV (Tokenized Invoice Liquidity Vault) is a RealFi protocol built on Mantle Network (Ethereum L2). It solves a real problem in emerging markets: SMEs in Indonesia wait 30–90 days to collect on invoices while needing working capital now. TILV lets them tokenize unpaid invoices as NFTs and unlock immediate liquidity from investor-funded vaults — all within 24 hours, bypassing traditional bank financing entirely.

Two sides to the marketplace:

- SMEs upload invoices, get AI-validated risk scores, mint them as NFTs, and receive advance funding
- Investors deposit into risk-tiered vaults and earn 4–25% APY backed by real invoice repayments

The protocol is live on Mantle testnet. Frontend is Next.js. Backend is Node.js/Express. AI engine is Python/FastAPI. Contracts are Solidity.

---

## Vault Structure

Three tiers stratify risk like tranches:

| Tier     | Risk Score | APY Range | Advance Rate |
|----------|------------|-----------|--------------|
| Prime    | 0–30       | 4–6%      | 80%          |
| Growth   | 31–60      | 8–12%     | 75%          |
| Emerging | 61–100     | 15–25%    | 70%          |

Tier constants in code: `PRIME = 0`, `GROWTH = 1`, `EMERGING = 2`

---

## Existing Contract Architecture

| Contract          | Responsibility                                              |
|-------------------|-------------------------------------------------------------|
| `InvoiceNFT.sol`  | Mints invoice NFTs, stores metadata and risk scores        |
| `VaultManager.sol`| Manages three vault tiers, handles deposits and rebalancing|
| `RiskEngine.sol`  | Stores and exposes average risk scores per vault tier      |

Do not modify these existing contracts. All new logic layers on top.

---

## New Integration: ERC-8004 Autonomous Yield Optimizer

This hackathon extends TILV with an autonomous AI agent that optimizes yield across the three vaults using ERC-8004 (Trustless Agents standard). The agent has a verifiable on-chain identity, its decisions are validated before execution, and outcomes are recorded as reputation feedback.

### New Files to Integrate

#### 1. `contracts/AgentController.sol`
The core new contract. Sits between ERC-8004 registries and the existing VaultManager.

Responsibilities:
- Registers the yield optimizer as an ERC-8004 agent (ERC-721 identity NFT)
- Accepts rebalancing proposals from the off-chain Python agent
- Submits each proposal to the ERC-8004 Validation Registry before execution
- Executes approved proposals by calling `VaultManager.rebalance()`
- Writes yield outcomes back to the ERC-8004 Reputation Registry as feedback

Key interfaces it depends on:
- `IERC8004Identity` — identity registry, mints agent NFT on first deploy
- `IERC8004Reputation` — reputation registry, records yield delta after each rebalance
- `IERC8004Validation` — validation registry, gates execution behind on-chain approval
- `IVaultManager` — existing contract, calls `rebalance()` and `getVaultState()`
- `IRiskEngine` — existing contract, reads `getAverageRiskScore()` per tier

Safety parameters (all owner-configurable):
- `maxRebalanceBps` — max 20% of total liquidity per transaction
- `cooldownPeriod` — 6 hours between rebalances
- `validationTimeout` — 30 minutes for validator to respond
- `paused` — emergency stop controlled by owner

Deploy order:
1. Deploy `AgentController.sol` with registry and vault addresses
2. Call `registerAgent(agentURI)` once to mint the ERC-721 agent identity
3. Grant `AGENT_ROLE` on `VaultManager` to `AgentController` address
4. Set `agentSigner` to the Python agent's wallet address

#### 2. `ai-engine/yield_optimizer.py`
New Python service inside the existing `ai-engine/` folder. Runs as a background process alongside the existing FastAPI risk scoring service.

Responsibilities:
- Polls vault state every `POLL_INTERVAL` seconds (default 1 hour) via `getVaultSnapshot()`
- Computes risk-adjusted APY differentials across the three tiers
- Identifies the best liquidity reallocation that exceeds `MIN_YIELD_DELTA_BPS` (default 50 bps)
- Signs and submits proposals to `AgentController.submitProposal()`
- Polls the ERC-8004 Validation Registry for a response
- Calls `AgentController.executeProposal()` once validation passes
- Logs all outcomes for off-chain monitoring

Required environment variables (add to existing `.env`):
```
RPC_URL=https://rpc.testnet.mantle.xyz
AGENT_PRIVATE_KEY=0x...
AGENT_CONTROLLER=0x...
VALIDATION_REGISTRY=0x...
POLL_INTERVAL=3600
MIN_YIELD_DELTA_BPS=50
```

Install new dependency:
```
pip install schedule
```

Run alongside existing ai-engine:
```
python yield_optimizer.py
```

#### 3. `public/agent_registration.json`
ERC-8004 identity file for the agent. Upload to IPFS and use the resulting CID as the `agentURI` when calling `registerAgent()`.

Before uploading, replace:
- `{IDENTITY_REGISTRY_ADDRESS}` with the deployed Identity Registry address on Mantle testnet
- `"agentId": null` with the actual tokenId returned after registration

---

## ERC-8004 Registry Addresses

ERC-8004 is a draft standard (as of May 2026). No official singleton exists on Mantle testnet yet. Deploy your own instances of the three registries from the reference implementation at:

https://eips.ethereum.org/EIPS/eip-8004

Deploy order for registries:
1. Deploy `IdentityRegistry.sol`
2. Deploy `ReputationRegistry.sol`, call `initialize(identityRegistryAddress)`
3. Deploy `ValidationRegistry.sol`, call `initialize(identityRegistryAddress)`

For hackathon purposes, a simple pass-through `MockValidator.sol` can be used as the `validatorAddress` — it accepts all proposals with `response = 100`. This lets you demo the full flow without a real zkML or TEE validator.

---

## Integration Touchpoints Summary

| Existing File         | Change Required                                              |
|-----------------------|--------------------------------------------------------------|
| `VaultManager.sol`    | Grant `AGENT_ROLE` to `AgentController` address             |
| `ai-engine/.env`      | Add 5 new environment variables                             |
| `ai-engine/` folder   | Add `yield_optimizer.py` as a new background service        |
| `contracts/` folder   | Add `AgentController.sol`                                   |
| `public/` folder      | Add `agent_registration.json`, upload to IPFS               |
| `hardhat.config.js`   | No changes needed                                           |
| Frontend (Next.js)    | Optional: add agent dashboard page to visualize reputation  |

---

## Key Design Decisions

- Existing contracts are untouched. `AgentController` wraps them non-destructively.
- The Python agent is stateless — all state lives on-chain. Safe to restart anytime.
- Reputation feedback uses `tag1: "tradingYield"` and `tag2: "week"` matching the ERC-8004 spec examples for yield tracking.
- The proposal hash is `keccak256(abi.encode(fromTier, toTier, amount, blockNumber))` — deterministic and replay-safe.
- Validation threshold is set at 70/100 to allow partial confidence scores from future zkML validators.

---

## Out of Scope for This Hackathon

- Production zkML or TEE validator (use MockValidator)
- IPFS pinning service (use data URIs for registration file)
- Frontend agent dashboard (optional stretch goal)
- Multi-agent coordination (single optimizer agent only)
