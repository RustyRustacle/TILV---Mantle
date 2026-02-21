'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Coins, Zap, ShieldAlert, ArrowUpRight } from 'lucide-react'

export default function InvestorDashboard() {
    const vaults = [
        {
            name: "Prime Vault",
            risk: "Low Risk",
            apy: "8.0%",
            tvl: "$1,250,000",
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            icon: <ShieldAlert className="w-6 h-6 text-blue-400" />
        },
        {
            name: "Growth Vault",
            risk: "Medium Risk",
            apy: "12.5%",
            tvl: "$850,000",
            color: "text-mantle-green",
            bg: "bg-mantle-green/10",
            icon: <Zap className="w-6 h-6 text-mantle-green" />
        },
        {
            name: "Emerging Vault",
            risk: "High Risk",
            apy: "15.0%",
            tvl: "$320,000",
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            icon: <ArrowUpRight className="w-6 h-6 text-purple-400" />
        }
    ]

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-mantle">Investor Vaults</h1>
                    <p className="text-gray-400 mt-2">Earn stable yields by funding real invoices</p>
                </div>

                <Card className="flex items-center gap-6 p-4 max-w-sm w-full">
                    <div>
                        <div className="text-sm text-gray-400">Your Total Portfolio</div>
                        <div className="text-2xl font-bold text-white">$15,400.00</div>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div>
                        <div className="text-sm text-gray-400">Est. Monthly Yield</div>
                        <div className="text-lg font-bold text-mantle-green">+$160.00</div>
                    </div>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vaults.map((vault, i) => (
                    <motion.div
                        key={vault.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Card className="h-full flex flex-col hover:border-mantle-green/20 transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${vault.bg}`}>
                                    {vault.icon}
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-bold ${vault.color}`}>{vault.apy}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider">Fixed APY</div>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-1">{vault.name}</h3>
                            <p className="text-sm text-gray-400 mb-6">{vault.risk}</p>

                            <div className="mt-auto space-y-4">
                                <div className="flex justify-between items-center py-3 border-y border-white/5">
                                    <span className="text-sm text-gray-400">TVL</span>
                                    <span className="font-medium text-white">{vault.tvl}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button variant="solid" className="w-full text-xs">Deposit</Button>
                                    <Button variant="outline" className="w-full text-xs">Withdraw</Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
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
    )
}
