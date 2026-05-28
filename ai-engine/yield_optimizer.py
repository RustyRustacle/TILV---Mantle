"""
TILV – yield_optimizer.py
=========================
Autonomous yield optimisation agent for TILV Tokenized Invoice
Liquidity Vaults. Runs as a background service inside ai-engine/.

Responsibilities
----------------
1. Poll vault state every POLL_INTERVAL seconds
2. Run optimisation logic to find the best liquidity reallocation
3. Submit a signed proposal to AgentController.sol via ERC-8004
4. Watch for the ValidationResponse event, then call executeProposal
5. Log the outcome

Dependencies
------------
pip install web3 python-dotenv schedule requests

Environment variables  (.env)
------------------------------
RPC_URL            = https://rpc.testnet.mantle.xyz
AGENT_PRIVATE_KEY  = 0x...      # agent signer wallet
AGENT_CONTROLLER   = 0x...      # deployed AgentController address
POLL_INTERVAL      = 3600       # seconds between optimisation cycles
MIN_YIELD_DELTA_BPS= 50         # minimum expected gain to bother rebalancing
IPFS_GATEWAY       = https://ipfs.io/ipfs/
"""

import os
import time
import json
import hashlib
import logging
import base64
import schedule
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv
from web3 import Web3
from web3.middleware import geth_poa_middleware

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("YieldOptimizer")

# ── Configuration ──────────────────────────────────────────────
RPC_URL             = os.getenv("RPC_URL", "https://rpc.testnet.mantle.xyz")
PRIVATE_KEY         = os.getenv("AGENT_PRIVATE_KEY")
AGENT_CONTROLLER    = os.getenv("AGENT_CONTROLLER")
POLL_INTERVAL       = int(os.getenv("POLL_INTERVAL", 3600))
MIN_YIELD_DELTA_BPS = int(os.getenv("MIN_YIELD_DELTA_BPS", 50))
VALIDATION_THRESHOLD = int(os.getenv("VALIDATION_THRESHOLD", 70))

# Vault tier constants (mirror Solidity enum)
PRIME    = 0   # risk 0-30,  4-6%  APY,  80% advance
GROWTH   = 1   # risk 31-60, 8-12% APY,  75% advance
EMERGING = 2   # risk 61-100,15-25% APY, 70% advance

TIER_LABELS = {PRIME: "Prime", GROWTH: "Growth", EMERGING: "Emerging"}

# ── AgentController ABI (minimal – only what we call) ─────────
AGENT_CONTROLLER_ABI = json.loads("""
[
  {
    "name": "getVaultSnapshot",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {"name": "tvls",          "type": "uint256[3]"},
      {"name": "utilizations",  "type": "uint256[3]"},
      {"name": "apys",          "type": "uint256[3]"},
      {"name": "riskScores",    "type": "uint256[3]"}
    ]
  },
    {
        "name": "submitProposal",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "fromTier",    "type": "uint8"},
            {"name": "toTier",      "type": "uint8"},
            {"name": "amount",      "type": "uint256"},
            {"name": "nonce",       "type": "uint256"},
            {"name": "requestURI",  "type": "string"},
            {"name": "requestHash", "type": "bytes32"}
        ],
        "outputs": []
    },
  {
    "name": "executeProposal",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "requestHash", "type": "bytes32"}],
    "outputs": []
  },
  {
    "name": "cooldownPeriod",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "lastRebalanceTime",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "paused",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "bool"}]
  },
  {
    "name": "validationTimeout",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "ProposalSubmitted",
    "type": "event",
    "inputs": [
      {"name": "requestHash", "type": "bytes32", "indexed": true},
      {"name": "fromTier",    "type": "uint8",   "indexed": false},
      {"name": "toTier",      "type": "uint8",   "indexed": false},
      {"name": "amount",      "type": "uint256", "indexed": false}
    ]
  },
  {
    "name": "ProposalExecuted",
    "type": "event",
    "inputs": [
      {"name": "requestHash", "type": "bytes32", "indexed": true},
      {"name": "fromTier",    "type": "uint8",   "indexed": false},
      {"name": "toTier",      "type": "uint8",   "indexed": false},
      {"name": "amount",      "type": "uint256", "indexed": false},
      {"name": "yieldDelta",  "type": "int128",  "indexed": false}
    ]
  }
]
""")

# ── ERC-8004 Validation Registry ABI (minimal) ────────────────
VALIDATION_REGISTRY_ABI = json.loads("""
[
  {
    "name": "getValidationStatus",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "requestHash", "type": "bytes32"}],
    "outputs": [
      {"name": "validatorAddress", "type": "address"},
      {"name": "agentId",          "type": "uint256"},
      {"name": "response",         "type": "uint8"},
      {"name": "responseHash",     "type": "bytes32"},
      {"name": "tag",              "type": "string"},
      {"name": "lastUpdate",       "type": "uint256"}
    ]
  },
  {
    "name": "ValidationResponded",
    "type": "event",
    "inputs": [
      {"name": "validatorAddress", "type": "address",  "indexed": true},
      {"name": "agentId",          "type": "uint256",  "indexed": true},
      {"name": "requestHash",      "type": "bytes32",  "indexed": true},
      {"name": "response",         "type": "uint8",    "indexed": false},
      {"name": "responseURI",      "type": "string",   "indexed": false},
      {"name": "responseHash",     "type": "bytes32",  "indexed": false},
      {"name": "tag",              "type": "string",   "indexed": false}
    ]
  }
]
""")


# ── Data structures ────────────────────────────────────────────
@dataclass
class VaultState:
    tier:        int
    label:       str
    tvl:         int   # wei
    utilization: int   # bps (7500 = 75%)
    apy:         int   # bps (600  = 6%)
    risk_score:  int   # 0-100

@dataclass
class RebalanceProposal:
    from_tier:    int
    to_tier:      int
    amount:       int   # wei
    rationale:    str
    expected_gain_bps: int


# ── Web3 setup ─────────────────────────────────────────────────
def build_w3() -> Web3:
    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 60}))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if not w3.is_connected():
        raise ConnectionError("Cannot connect to RPC")
    return w3

def build_contracts(w3: Web3):
    controller = w3.eth.contract(
        address=Web3.to_checksum_address(AGENT_CONTROLLER),
        abi=AGENT_CONTROLLER_ABI
    )
    # Read validationRegistry address from on-chain storage if available,
    # otherwise set via env. Here we read it from env for simplicity.
    validation_registry_addr = os.getenv("VALIDATION_REGISTRY")
    validation = None
    if validation_registry_addr:
        validation = w3.eth.contract(
            address=Web3.to_checksum_address(validation_registry_addr),
            abi=VALIDATION_REGISTRY_ABI
        )
    return controller, validation


# ── Vault state reader ─────────────────────────────────────────
def fetch_vault_states(controller) -> list[VaultState]:
    tvls, utils, apys, risks = controller.functions.getVaultSnapshot().call()
    states = []
    for tier in (PRIME, GROWTH, EMERGING):
        states.append(VaultState(
            tier=tier,
            label=TIER_LABELS[tier],
            tvl=tvls[tier],
            utilization=utils[tier],
            apy=apys[tier],
            risk_score=risks[tier]
        ))
    return states


# ── Core optimisation logic ────────────────────────────────────
#
# Strategy: find the vault pair where moving capital produces the
# largest expected yield improvement, subject to:
#  - source vault must have meaningful idle capital (utilisation < 80%)
#  - destination vault must not be over-utilised (< 90%)
#  - risk-adjusted APY gain must exceed MIN_YIELD_DELTA_BPS
#
# This is intentionally simple for a hackathon prototype.
# In production, plug in a proper optimisation model (scipy, cvxpy)
# or call the existing FastAPI risk endpoint.

def risk_adjusted_apy(vault: VaultState) -> float:
    """Lower risk score = higher quality. Penalise high-risk vaults."""
    risk_penalty = vault.risk_score * 0.5  # 0.5 bps per risk point
    return vault.apy - risk_penalty        # still in bps


def find_best_rebalance(states: list[VaultState]) -> Optional[RebalanceProposal]:
    best: Optional[RebalanceProposal] = None
    best_gain = MIN_YIELD_DELTA_BPS  # must beat this threshold

    for src in states:
        idle_bps = 10000 - src.utilization           # e.g. 2500 bps = 25% idle
        if idle_bps < 500:                           # skip if less than 5% idle
            continue
        # Move at most 15% of src TVL per cycle
        move_frac = min(idle_bps / 10000 * 0.5, 0.15)
        amount    = int(src.tvl * move_frac)
        if amount == 0:
            continue

        for dst in states:
            if dst.tier == src.tier:
                continue
            if dst.utilization > 9000:               # skip near-full vaults
                continue

            src_ra_apy = risk_adjusted_apy(src)
            dst_ra_apy = risk_adjusted_apy(dst)
            gain_bps   = dst_ra_apy - src_ra_apy

            if gain_bps > best_gain:
                best_gain = gain_bps
                best = RebalanceProposal(
                    from_tier=src.tier,
                    to_tier=dst.tier,
                    amount=amount,
                    rationale=(
                        f"Move {move_frac*100:.1f}% of {src.label} idle liquidity "
                        f"to {dst.label}. Risk-adjusted APY gain: "
                        f"+{gain_bps:.0f} bps. "
                        f"Source util: {src.utilization/100:.1f}%, "
                        f"dest util: {dst.utilization/100:.1f}%."
                    ),
                    expected_gain_bps=int(gain_bps)
                )

    return best


# ── Request hash builder ───────────────────────────────────────
_nonce_counter = 0

def make_request_hash(w3: Web3, from_tier: int, to_tier: int,
                      amount: int, sender: str) -> tuple[bytes, int]:
    global _nonce_counter
    _nonce_counter += 1
    encoded = w3.codec.encode(
        ["uint8", "uint8", "uint256", "uint256", "address"],
        [from_tier, to_tier, amount, _nonce_counter, sender]
    )
    return w3.keccak(encoded), _nonce_counter


# ── Transaction sender ─────────────────────────────────────────
MAX_RETRIES = 3
RETRY_DELAY_S = 5

def send_tx(w3: Web3, account, contract_fn) -> str:
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            tx = contract_fn.build_transaction({
                "from":    account.address,
                "nonce":   w3.eth.get_transaction_count(account.address, "pending"),
                "gas":     w3.eth.estimate_gas(contract_fn.build_transaction({
                    "from": account.address
                })),
                "gasPrice": w3.eth.gas_price,
            })
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if receipt["status"] != 1:
                raise RuntimeError(f"Tx reverted: {tx_hash.hex()}")
            return tx_hash.hex()
        except Exception as e:
            log.warning(f"send_tx attempt {attempt}/{MAX_RETRIES} failed: {e}")
            last_exc = e
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_S * attempt)
    raise RuntimeError(f"send_tx failed after {MAX_RETRIES} attempts") from last_exc


# ── Validation poller ──────────────────────────────────────────
def wait_for_validation(w3: Web3, validation, request_hash: bytes,
                        timeout_s: int = 1800,
                        poll_s: int = 15) -> bool:
    """
    Poll the Validation Registry for a ValidationResponded event matching
    the given request_hash. Returns True if response >= 70 (pass threshold).
    """
    if validation is None:
        log.warning("No ValidationRegistry configured – skipping validation wait")
        return True

    event_signature = w3.keccak(
        "ValidationResponded(address,uint256,bytes32,uint8,string,bytes32,string)"
    )

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            logs = w3.eth.get_logs({
                "address":  validation.address,
                "fromBlock": w3.eth.block_number - 100,
                "toBlock":   "latest",
                "topics":    [event_signature, None, None, request_hash]
            })
            if logs:
                decoded = validation.events.ValidationResponded().process_log(logs[-1])
                response = decoded["args"]["response"]
                log.info(f"Validation response: {response}/100 (threshold: {VALIDATION_THRESHOLD})")
                return response >= VALIDATION_THRESHOLD
        except Exception as e:
            log.debug(f"Validation poll error (will retry): {e}")
        time.sleep(poll_s)

    log.warning("Validation timed out")
    return False


# ── Main cycle ─────────────────────────────────────────────────
def optimisation_cycle(w3: Web3, controller, validation, account):
    log.info("── Optimisation cycle starting ──")

    # Safety checks
    if controller.functions.paused().call():
        log.info("AgentController is paused – skipping cycle")
        return

    last_rb   = controller.functions.lastRebalanceTime().call()
    cooldown  = controller.functions.cooldownPeriod().call()
    now       = w3.eth.get_block("latest")["timestamp"]
    if now < last_rb + cooldown:
        remaining = (last_rb + cooldown) - now
        log.info(f"Cooldown active – {remaining}s remaining")
        return

    # Fetch vault states
    states = fetch_vault_states(controller)
    for s in states:
        log.info(
            f"  {s.label}: TVL={s.tvl/1e18:.2f} MNT "
            f"util={s.utilization/100:.1f}% "
            f"APY={s.apy/100:.2f}% "
            f"risk={s.risk_score}"
        )

    # Run optimiser
    proposal = find_best_rebalance(states)
    if proposal is None:
        log.info("No profitable rebalance found this cycle")
        return

    log.info(f"Proposal: {proposal.rationale}")

    # Build request hash with nonce (avoids block.number race)
    request_hash, nonce = make_request_hash(
        w3, proposal.from_tier, proposal.to_tier, proposal.amount, account.address
    )

    # Build a lightweight off-chain reasoning JSON
    # In production, upload to IPFS and use the real CID
    reasoning = {
        "type":    "https://eips.ethereum.org/EIPS/eip-8004#validation-v1",
        "agentId": "tilv-yield-optimizer-v1",
        "nonce":   nonce,
        "proposal": {
            "fromTier":       proposal.from_tier,
            "toTier":         proposal.to_tier,
            "amountWei":      str(proposal.amount),
            "rationale":      proposal.rationale,
            "expectedGainBps": proposal.expected_gain_bps
        },
        "vaultSnapshot": [
            {
                "tier":        s.tier,
                "tvl":         str(s.tvl),
                "utilization": s.utilization,
                "apy":         s.apy,
                "riskScore":   s.risk_score
            }
            for s in states
        ]
    }
    request_uri = "data:application/json;base64," + \
        base64.b64encode(
            json.dumps(reasoning).encode()
        ).decode()

    # Submit proposal
    log.info("Submitting proposal to AgentController…")
    submit_fn = controller.functions.submitProposal(
        proposal.from_tier,
        proposal.to_tier,
        proposal.amount,
        nonce,
        request_uri,
        request_hash
    )
    tx_hash = send_tx(w3, account, submit_fn)
    log.info(f"Proposal submitted: {tx_hash}")

    # Wait for ERC-8004 validation response (emitted by ValidationRegistry)
    log.info("Waiting for on-chain validation…")
    validated = wait_for_validation(
        w3,
        validation,
        request_hash,
        timeout_s=int(controller.functions.validationTimeout().call())
    )

    if not validated:
        log.warning("Validation failed or timed out – not executing")
        return

    # Execute proposal
    log.info("Executing validated proposal…")
    exec_fn  = controller.functions.executeProposal(request_hash)
    exec_tx  = send_tx(w3, account, exec_fn)
    log.info(f"Proposal executed: {exec_tx}")

    # Fetch updated vault states for logging
    updated = fetch_vault_states(controller)
    for s in updated:
        log.info(
            f"  Post-rebalance {s.label}: "
            f"APY={s.apy/100:.2f}% util={s.utilization/100:.1f}%"
        )

    log.info("── Optimisation cycle complete ──")


# ── Entry point ────────────────────────────────────────────────
def main():
    if not PRIVATE_KEY:
        raise ValueError("AGENT_PRIVATE_KEY not set in .env")
    if not AGENT_CONTROLLER:
        raise ValueError("AGENT_CONTROLLER not set in .env")

    w3           = build_w3()
    # NOTE: Private key stays in memory for the process lifetime.
    # For production, use an external signer or keystore pattern:
    #   w3.eth.account.load("keystore.json", "password")
    account      = w3.eth.account.from_key(PRIVATE_KEY)
    controller, validation = build_contracts(w3)

    log.info(f"Agent wallet : {account.address}")
    log.info(f"Controller   : {AGENT_CONTROLLER}")
    log.info(f"Poll interval: {POLL_INTERVAL}s")

    # Run once immediately, then on schedule
    optimisation_cycle(w3, controller, validation, account)

    schedule.every(POLL_INTERVAL).seconds.do(
        optimisation_cycle, w3, controller, validation, account
    )
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
