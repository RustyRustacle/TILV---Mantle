'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletGate } from '@/components/ui/WalletGate'
import { Coins, Zap, ShieldAlert, ArrowUpRight, Loader2 } from 'lucide-react'
import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { VAULT_MANAGER_ABI } from '@/lib/vaultManager.abi'
import { formatUnits, parseUnits } from 'viem'

const VAULT_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS as `0x${string}`
const STABLECOIN_DECIMALS = 6

const VAULT_META = [
  { name: 'Prime Vault', risk: 'Low Risk', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <ShieldAlert className="w-6 h-6 text-blue-400" /> },
  { name: 'Growth Vault', risk: 'Medium Risk', color: 'text-mantle-green', bg: 'bg-mantle-green/10', icon: <Zap className="w-6 h-6 text-mantle-green" /> },
  { name: 'Emerging Vault', risk: 'High Risk', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: <ArrowUpRight className="w-6 h-6 text-purple-400" /> },
]

function formatCurrency(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals)
  const num = parseFloat(formatted)
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function VaultCard({ index }: { index: number }) {
  const meta = VAULT_META[index]
  const { address } = useAccount()
  const [depositAmount, setDepositAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)

  const { data: vaultState, refetch: refetchState } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getVaultState',
    args: [index],
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })

  const { data: vault } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getVault',
    args: [index],
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })

  const { data: ownPosition, refetch: refetchPosition } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getPosition',
    args: [index, address ?? '0x0'],
    query: { enabled: !!VAULT_MANAGER_ADDRESS && !!address },
  })

  const { writeContractAsync } = useWriteContract()

  const tvl = vaultState?.[0] ?? BigInt(0)
  const utilization = vaultState?.[1] ?? BigInt(0)
  const rawApy = vaultState?.[2] ?? BigInt(0)
  const apyPercent = rawApy ? (Number(rawApy) / 100).toFixed(1) : '0.0'
  const tvlFormatted = vaultState ? formatCurrency(tvl, STABLECOIN_DECIMALS) : '$0'
  const myDeposits = ownPosition?.[0] ?? BigInt(0)
  const myShares = ownPosition?.[1] ?? BigInt(0)
  const myReturns = ownPosition?.[3] ?? BigInt(0)

  const minDeposit = vault?.[5] ?? BigInt(0)

  async function handleDeposit() {
    if (!depositAmount || !address) return
    setIsDepositing(true)
    try {
      const amount = parseUnits(depositAmount.replace(/,/g, ''), STABLECOIN_DECIMALS)
      await writeContractAsync({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'deposit',
        args: [index, amount, BigInt(0)],
      })
      setDepositAmount('')
      await refetchState()
      await refetchPosition()
    } catch (e) {
      console.error('Deposit failed:', e)
    } finally {
      setIsDepositing(false)
    }
  }

  return (
    <Card className="h-full flex flex-col border border-white/10 hover:border-mantle-green/20 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.bg}`}>
          {meta.icon}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${apyPercent !== '0.0' ? meta.color : 'text-gray-500'}`}>
            {apyPercent !== '0.0' ? `${apyPercent}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Fixed APY</div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-1">{meta.name}</h3>
      <p className="text-sm text-gray-400 mb-4">{meta.risk}</p>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">TVL</span>
          <span className="font-medium text-white">{tvlFormatted}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Utilization</span>
          <span className="font-medium text-white">{utilization ? `${(Number(utilization) / 100).toFixed(1)}%` : '0%'}</span>
        </div>
        {address && myDeposits > BigInt(0) && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">My Deposit</span>
              <span className="font-medium text-white">{formatCurrency(myDeposits, STABLECOIN_DECIMALS)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">My Returns</span>
              <span className="font-medium text-mantle-green">+{formatCurrency(myReturns, STABLECOIN_DECIMALS)}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder={minDeposit ? `Min ${formatCurrency(minDeposit, STABLECOIN_DECIMALS)}` : 'Amount'}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9,]/g, ''))}
            className="flex-1 bg-mantle-darker border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-mantle-green"
          />
          <Button
            size="sm"
            onClick={handleDeposit}
            disabled={isDepositing || !depositAmount || !address}
          >
            {isDepositing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deposit'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function PortfolioSummary() {
  const { address } = useAccount()

  const { data: primePos } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getPosition',
    args: [0, address ?? '0x0'],
    query: { enabled: !!VAULT_MANAGER_ADDRESS && !!address },
  })

  const { data: growthPos } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getPosition',
    args: [1, address ?? '0x0'],
    query: { enabled: !!VAULT_MANAGER_ADDRESS && !!address },
  })

  const { data: emergingPos } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getPosition',
    args: [2, address ?? '0x0'],
    query: { enabled: !!VAULT_MANAGER_ADDRESS && !!address },
  })

  const totalDeposited = (primePos?.[0] ?? BigInt(0)) + (growthPos?.[0] ?? BigInt(0)) + (emergingPos?.[0] ?? BigInt(0))
  const totalYield = (primePos?.[3] ?? BigInt(0)) + (growthPos?.[3] ?? BigInt(0)) + (emergingPos?.[3] ?? BigInt(0))

  return (
    <Card className="flex items-center gap-6 p-4 max-w-sm w-full">
      <div>
        <div className="text-sm text-gray-400">Your Total Portfolio</div>
        <div className="text-2xl font-bold text-white">
          {formatCurrency(totalDeposited, STABLECOIN_DECIMALS)}
        </div>
      </div>
      <div className="w-px h-10 bg-white/10" />
      <div>
        <div className="text-sm text-gray-400">Est. Yield Earned</div>
        <div className="text-lg font-bold text-mantle-green">
          +{formatCurrency(totalYield, STABLECOIN_DECIMALS)}
        </div>
      </div>
    </Card>
  )
}

export default function InvestorDashboard() {
  return (
    <WalletGate>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-mantle">Investor Vaults</h1>
            <p className="text-gray-400 mt-2">Earn stable yields by funding real invoices</p>
          </div>
          <PortfolioSummary />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={VAULT_META[i].name}>
              <VaultCard index={i} />
            </div>
          ))}
        </div>
      </div>
    </WalletGate>
  )
}
