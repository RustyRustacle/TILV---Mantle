# TILV - Tokenized Invoice Liquidity Vault

[![Built on Mantle](https://img.shields.io/badge/Built%20on-Mantle-black)](https://mantle.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **RealFi platform enabling SMEs to tokenize invoices for instant liquidity while investors earn stable yields backed by real economic activity.**

TILV transforms traditional invoice financing by leveraging blockchain technology, AI-powered risk assessment, and tokenization. SMEs can upload invoices, get AI validation, and receive liquidity in 24-48 hours. Investors provide liquidity through risk-tiered vaults and earn yields from invoice repayments.

## Live on Mantle Mainnet

| Contract | Address |
|----------|---------|
| InvoiceNFT | `0x504D3dcc9fe0dbD38f6EbC0509a09fb578dFa3A7` |
| RiskEngine | `0x95768Da9D39E4D9E1B1E7C76F7091ceeb6404Ddd` |
| VaultManager | `0x8FafC9dAc6342310fFd87497aCa9D405142EaA6D` |
| AgentController | `0x42E1DDa459F2c38AdEefd82DA0C9cc1373bFdDBF` |
| IdentityRegistry | `0xFa2786449B5020bCf2C8bdD7e458D9cCC76F1f1b` |
| ReputationRegistry | `0xB8e763e71006fB2B5Bb7971f5766bB490F71F108` |
| ValidationRegistry | `0x7E9cb695a519cf544F7b774857B630cBf2EF65d9` |
| USDT | `0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE` |

## Key Features

- **For SMEs**: Convert invoices to instant cash without traditional bank loans
- **For Investors**: Earn 4-25% APY from real-world cashflows
- **AI-Powered**: Automated OCR, validation, and risk scoring
- **On-Chain**: Transparent, immutable record on Mantle Network
- **Secure**: Multi-tier risk assessment and vault system

## Tech Stack

- **Blockchain**: Mantle Network, Solidity 0.8.20, Hardhat
- **Backend**: Node.js, Express, TypeScript, MongoDB, Redis
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Wagmi, RainbowKit
- **AI/ML**: Python, FastAPI, Tesseract OCR
- **DevOps**: Docker, Docker Compose

## Project Structure

```
TILV---Mantle/
├── contracts/          # Solidity smart contracts (src/) + tests (test/)
│   ├── VaultManager.sol
│   ├── InvoiceNFT.sol
│   ├── RiskEngine.sol
│   ├── AgentController.sol
│   └── EmergencyPause.sol
├── backend/            # Node.js/Express API (src/)
├── frontend/           # Next.js app (app/, components/)
├── ai-engine/          # Python FastAPI + yield optimizer
├── docker/             # Docker Compose for all services
└── scripts/            # Setup automation
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
cp frontend/.env.example frontend/.env.local
# Fill in the values

# Start with Docker
npm run docker:up
```

### Access
- HTTPS app via Caddy: https://localhost
- Frontend direct port: http://localhost:3000
- Backend API direct port: http://localhost:3001
- AI Engine direct port: http://localhost:5000

### Docker TLS

Docker Compose includes a Caddy reverse proxy on ports 80 and 443. For local development, `CADDY_SITE_ADDRESS=localhost` uses Caddy's local TLS certificate, so your browser may ask you to trust the local certificate authority.

For a public deployment, set `CADDY_SITE_ADDRESS` and `CORS_ORIGIN` to your HTTPS domain in `docker/.env`, point DNS at the server, and make sure ports 80 and 443 are reachable. Caddy will request and renew Let's Encrypt certificates automatically.

## Smart Contracts

### VaultManager
Three-tier liquidity vault with deposit, withdraw, fund invoice, process repayment, and rebalance functions. Uses share-based pricing with proper accounting.

- **Prime**: Low risk (0-30 score), 80% advance rate
- **Growth**: Mid risk (31-60 score), 75% advance rate
- **Emerging**: High yield (61-100 score), 70% advance rate

### InvoiceNFT
ERC-721 token for invoice lifecycle: PENDING -> VALIDATED -> FUNDED -> PAID/DEFAULTED/CANCELLED. Uses OpenZeppelin v4.9 with AccessControl.

### RiskEngine
On-chain risk scoring with authorized oracles. Stores assessments, tracks tier averages, and enforces validity periods.

### AgentController
Manages the yield optimization agent via ERC-8004 interaction. Handles proposal submission, on-chain validation, and execution with cooldown and safety limits.

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
```

## Deployment

### Mainnet

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network mantleMainnet
npx hardhat verify --network mantleMainnet <address>
```

### Testnet

```bash
cd contracts
npm run deploy:testnet
npm run verify:testnet
```

## Security

All critical functions are protected by:
- ReentrancyGuard
- AccessControl (role-based)
- Emergency pause/shutdown
- Slippage protection on withdrawals
- On-chain proposal hash verification
- Wallet signature verification on AI engine

## License

MIT
