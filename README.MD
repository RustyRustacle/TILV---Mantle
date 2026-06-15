# TILV - Tokenized Invoice Liquidity Vault

<p align="center">
  <img src="frontend/public/banner.png" alt="TILV Banner" width="100%">
</p>

[![Built on Mantle](https://img.shields.io/badge/Built%20on-Mantle-black)](https://mantle.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **RealFi platform enabling SMEs to tokenize invoices for instant liquidity while investors earn stable yields backed by real economic activity.**

TILV transforms traditional invoice financing by leveraging blockchain technology, AI-powered risk assessment, and tokenization. SMEs upload invoices, get AI validation, and receive liquidity within 24 hours. Investors provide liquidity through risk-tiered vaults and earn yields from invoice repayments.

## Live on Mantle Mainnet

| Contract | Address |
|----------|---------|
| InvoiceNFT | `0x07850E07d36d00d44ed605140025DeB1e801a0f3` |
| RiskEngine | `0x146B1D2d8bA9cD85A44cf1E980E5c657f32643F5` |
| VaultManager | `0xa66D278d104A2F158BD90a5eb88531f7BD702E73` |
| AgentController | `0x0f2ef2e53ab6B6237A5A11543185B686Ffe9f210` |
| IdentityRegistry | `0xd1e1837A45c75a2e1Be2800f380950cCe373ad5a` |
| ReputationRegistry | `0x4dE534158840Af1e8cFA1862F926F79FD772A519` |
| ValidationRegistry | `0xBA3530d53d2AabF2538Bf880dA4B8e74933567b6` |
| USDT | `0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE` |

## Key Features

- **For SMEs**: Convert invoices to instant cash without traditional bank loans
- **For Investors**: Earn 4-25% APY from real-world cashflows across three risk tiers
- **AI-Powered**: Automated OCR, validation, and risk scoring via FastAPI
- **Autonomous Yield Optimizer**: ERC-8004 agent that rebalances vault liquidity for maximum yield
- **On-Chain**: Transparent, immutable records on Mantle Network
- **Monitoring**: Prometheus metrics and Grafana dashboards for production observability

## Tech Stack

- **Blockchain**: Mantle Network, Solidity 0.8.20, Hardhat, ethers.js v6
- **Backend**: Node.js, Express, TypeScript, MongoDB, Redis, JWT
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Wagmi v2, RainbowKit v2, viem v2
- **AI/ML**: Python, FastAPI, Tesseract OCR, web3.py
- **DevOps**: Docker, Docker Compose, Prometheus, Grafana, Supervisor

## Project Structure

```
TILV---Mantle/
├── contracts/            # Solidity smart contracts
│   ├── src/
│   │   ├── VaultManager.sol       # Three-tier vault with rebalancing
│   │   ├── InvoiceNFT.sol         # Invoice lifecycle ERC-721
│   │   ├── RiskEngine.sol         # On-chain risk scoring
│   │   ├── AgentController.sol    # ERC-8004 yield optimizer agent
│   │   ├── IdentityRegistry.sol   # ERC-8004 agent identity
│   │   ├── ReputationRegistry.sol # ERC-8004 reputation feedback
│   │   ├── ValidationRegistry.sol # ERC-8004 validation gateway
│   │   ├── EmergencyPause.sol     # Pausable access control
│   │   └── MockERC20.sol         # Test token
│   ├── test/              # Contract tests (Jest/Hardhat)
│   └── scripts/           # Deploy scripts (fresh + upgrade)
├── backend/              # Node.js/Express API
│   └── src/
│       ├── index.ts              # Express server with routes
│       ├── config/               # Env config + DB connection
│       ├── models/               # Mongoose schemas
│       ├── services/             # Ethers provider + metrics
│       ├── middleware/           # Auth, validation, MIME checks
│       └── __tests__/            # Jest tests
├── frontend/             # Next.js 14 app
│   ├── app/                      # Pages (landing, investor, borrower)
│   ├── components/               # Navbar, Button, Card, WalletGate
│   ├── lib/                      # Wagmi config + ABIs
│   └── public/                   # Static assets (logo, banner)
├── ai-engine/            # Python AI services
│   ├── main.py                   # FastAPI OCR + risk scoring
│   ├── yield_optimizer.py        # Autonomous ERC-8004 agent
│   ├── invoice_ocr/              # OCR processor
│   ├── risk_scoring/             # Risk model
│   ├── validation/               # Invoice validator
│   └── start.sh                  # Supervisor-managed startup
├── docker/               # Infrastructure
│   ├── docker-compose.yml        # Full stack (MongoDB, Redis, API, Frontend, AI)
│   ├── docker-compose.prod.yml   # Production + Prometheus/Grafana
│   └── prometheus/grafana/       # Monitoring configs
├── scripts/              # Setup automation
└── public/               # Agent registration JSON
```

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.9+, Docker
- MetaMask with Mantle network
- Tesseract OCR

### Run Locally

```bash
# Install all dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp ai-engine/.env.example ai-engine/.env

# Start with Docker
npm run docker:up
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- AI Engine: http://localhost:5000
- Grafana: http://localhost:3002
- Prometheus: http://localhost:9090

## Smart Contracts

### VaultManager
Three-tier liquidity vault with deposit, withdraw, fund invoice, process repayment, and rebalance functions. Uses share-based pricing with ReentrancyGuard protection.

| Tier | Risk Score | APY Range | Advance Rate |
|------|-----------|-----------|--------------|
| Prime | 0-30 | 4-6% | 80% |
| Growth | 31-60 | 8-12% | 75% |
| Emerging | 61-100 | 15-25% | 70% |

### InvoiceNFT
ERC-721 token for invoice lifecycle: `PENDING -> VALIDATED -> FUNDED -> PAID/DEFAULTED/CANCELLED`. Uses OpenZeppelin AccessControl with MINTER_ROLE and VALIDATOR_ROLE.

### RiskEngine
On-chain risk scoring with authorized oracles. Stores assessments per invoice, tracks per-tier average scores, and enforces validity periods.

### AgentController
ERC-8004 integration contract that manages the yield optimizer agent. Submits rebalance proposals to ValidationRegistry, executes approved ones via VaultManager, and records reputation feedback.

### ERC-8004 Registries
Three registries deployed for the autonomous agent standard:
- **IdentityRegistry**: ERC-721 based agent identity NFTs
- **ReputationRegistry**: Stores yield performance feedback (tag1: "tradingYield", tag2: "week")
- **ValidationRegistry**: Gates execution behind validator approval (threshold: 70/100)

## Autonomous Yield Optimizer

The `yield_optimizer.py` service runs alongside the AI engine and:

1. Polls vault state every hour via `getVaultSnapshot()`
2. Computes risk-adjusted APY differentials across tiers
3. Signs and submits rebalance proposals via ERC-8004
4. Waits for on-chain validation approval
5. Executes approved proposals via AgentController
6. Logs outcomes and reputation feedback

Safety constraints: max 20% liquidity per rebalance, 6-hour cooldown, 30-minute validation timeout.

## Development

```bash
# Compile contracts
cd contracts && npx hardhat compile

# Run all tests
npm run test:all

# Test specific contract
cd contracts && npx hardhat test test/VaultManager.test.js

# Backend dev
cd backend && npm run dev

# Frontend dev
cd frontend && npm run dev

# AI engine dev
cd ai-engine && uvicorn main:app --reload
```

## Deployment

### Mainnet (Fresh Deploy)

```bash
cd contracts
npx hardhat run scripts/deploy_fresh.ts --network mantleMainnet
npx hardhat verify --network mantleMainnet <address>
```

### Upgrade (Deploy Only AgentController + Registries)

```bash
cd contracts
npx hardhat run scripts/deploy_upgrade.ts --network mantleMainnet
```

Contracts are deployed in order: IdentityRegistry, ReputationRegistry, ValidationRegistry, InvoiceNFT, RiskEngine, VaultManager, AgentController, then role configuration.

## Monitoring

Production stack includes Prometheus metrics scraping and a pre-configured Grafana dashboard with:
- HTTP request rate and latency (p99)
- Active connections
- Contract call counters
- Service health status

Start with monitoring: `docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d`

## Security

- ReentrancyGuard on all vault operations
- AccessControl with granular roles (MINTER, VALIDATOR, PAUSER, AGENT)
- Emergency pause/shutdown with multi-role control
- Slippage protection on withdrawals
- On-chain proposal hash verification (keccak256)
- Wallet signature verification on AI engine
- Magic-byte MIME validation on file uploads
- Rate limiting on all API endpoints

## License

MIT
