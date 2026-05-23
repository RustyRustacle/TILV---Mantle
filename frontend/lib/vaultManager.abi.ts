export const VAULT_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getVaultState',
    stateMutability: 'view',
    inputs: [{ name: 'tier', type: 'uint8' }],
    outputs: [
      { name: 'tvl', type: 'uint256' },
      { name: 'utilization', type: 'uint256' },
      { name: 'currentApy', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getVault',
    stateMutability: 'view',
    inputs: [{ name: 'tier', type: 'uint8' }],
    outputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'totalDeposits', type: 'uint256' },
      { name: 'totalAllocated', type: 'uint256' },
      { name: 'totalReturns', type: 'uint256' },
      { name: 'totalBadDebt', type: 'uint256' },
      { name: 'minDeposit', type: 'uint256' },
      { name: 'maxRiskScore', type: 'uint256' },
      { name: 'advanceRate', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getTotalLiquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'investor', type: 'address' },
    ],
    outputs: [
      { name: 'depositedAmount', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'depositTimestamp', type: 'uint256' },
      { name: 'claimedReturns', type: 'uint256' },
    ],
  },
] as const