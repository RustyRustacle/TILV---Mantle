'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletGate } from '@/components/ui/WalletGate'
import { Coins, Zap, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { useReadContract } from 'wagmi'
import { VAULT_MANAGER_ABI } from '@/lib/vaultManager.abi'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'

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

  const { data: vaultState } = useReadContract({
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

  const tvl = vaultState?.[0] ?? BigInt(0)
  const rawApy = vaultState?.[2] ?? BigInt(0)
  const apyPercent = rawApy ? (Number(rawApy) / 100).toFixed(1) : (index === 0 ? '8.0' : index === 1 ? '12.5' : '15.0')
  const tvlFormatted = vaultState ? formatCurrency(tvl, STABLECOIN_DECIMALS) : '$0'

  return (
    <Card className="h-full flex flex-col hover:border-mantle-green/20 transition-all cursor-pointer">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.bg}`}>
          {meta.icon}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${meta.color}`}>{apyPercent}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Fixed APY</div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-1">{meta.name}</h3>
      <p className="text-sm text-gray-400 mb-6">{meta.risk}</p>

      <div className="mt-auto space-y-4">
        <div className="flex justify-between items-center py-3 border-y border-white/5">
          <span className="text-sm text-gray-400">TVL</span>
          <span className="font-medium text-white">{tvlFormatted}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="solid" className="w-full text-xs">Deposit</Button>
          <Button variant="outline" className="w-full text-xs">Withdraw</Button>
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

  if (!address) {
    return (
      <Card className="flex items-center gap-6 p-4 max-w-sm w-full">
        <div>
          <div className="text-sm text-gray-400">Your Total Portfolio</div>
          <div className="text-2xl font-bold text-white">$0.00</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div>
          <div className="text-sm text-gray-400">Est. Monthly Yield</div>
          <div className="text-lg font-bold text-mantle-green">+$0.00</div>
        </div>
      </Card>
    )
  }

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
        <div className="text-sm text-gray-400">Est. Monthly Yield</div>
        <div className="text-lg font-bold text-mantle-green">
          +{formatCurrency(totalYield, STABLECOIN_DECIMALS)}
        </div>
      </div>
    </Card>
  )
}

export default function InvestorDashboard() {
  const [mounted] = useState(true)

  return (
    <WalletGate>
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-mantle">Investor Vaults</h1>
          <p className="text-gray-400 mt-2">Earn stable yields by funding real invoices</p>
        </div>
        {mounted && <PortfolioSummary />}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {VAULT_META.map((_, i) => (
          <div key={VAULT_META[i].name}>
            <VaultCard index={i} />
          </div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="py-4 px-6 font-medium">Type</th>
                <th className="py-4 px-6 font-medium">Vault</th>
                <th className="py-4 px-6 font-medium">Amount</th>
                <th className="py-4 px-6 font-medium hidden sm:table-cell">Time</th>
                <th className="py-4 px-6 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 px-6 font-medium text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-mantle-green" /> Deposit
                </td>
                <td className="py-4 px-6 text-gray-300">Growth Vault</td>
                <td className="py-4 px-6 text-white font-mono">$5,000.00</td>
                <td className="py-4 px-6 text-gray-500 hidden sm:table-cell">2 days ago</td>
                <td className="py-4 px-6 text-right text-mantle-green text-xs font-semibold">SUCCESS</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 px-6 font-medium text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" /> Deposit
                </td>
                <td className="py-4 px-6 text-gray-300">Prime Vault</td>
                <td className="py-4 px-6 text-white font-mono">$10,400.00</td>
                <td className="py-4 px-6 text-gray-500 hidden sm:table-cell">1 week ago</td>
                <td className="py-4 px-6 text-right text-mantle-green text-xs font-semibold">SUCCESS</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
    </WalletGate>
  )
}