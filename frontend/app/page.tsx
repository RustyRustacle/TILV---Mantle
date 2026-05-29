'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ShieldCheck, Zap, Coins, ArrowRight, Wallet, ChevronRight, Activity, Cpu } from 'lucide-react'
import { useRef } from 'react'
import { useReadContract } from 'wagmi'
import { VAULT_MANAGER_ABI } from '@/lib/vaultManager.abi'
import { formatUnits } from 'viem'

const VAULT_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS as `0x${string}`
const STABLECOIN_DECIMALS = 6
const BASIS_POINTS = 10000

function formatCurrency(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals)
  const num = parseFloat(formatted)
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function HeroStats() {
  const { data: vault0 } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getVault',
    args: [0],
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })
  const { data: vault1 } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getVault',
    args: [1],
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })
  const { data: vault2 } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getVault',
    args: [2],
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })
  const { data: aum } = useReadContract({
    address: VAULT_MANAGER_ADDRESS,
    abi: VAULT_MANAGER_ABI,
    functionName: 'getTotalAUM',
    query: { enabled: !!VAULT_MANAGER_ADDRESS },
  })

  const totalAum = aum ?? BigInt(0)
  const totalDepositsAll = (vault0?.[1] ?? BigInt(0)) + (vault1?.[1] ?? BigInt(0)) + (vault2?.[1] ?? BigInt(0))
  const totalBadDebt = (vault0?.[4] ?? BigInt(0)) + (vault1?.[4] ?? BigInt(0)) + (vault2?.[4] ?? BigInt(0))
  const vaultCount = [vault0, vault1, vault2].filter(v => v !== undefined).length

  return (
    <section className="relative z-20 py-10 px-6 -mt-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="glass-card rounded-3xl p-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10 text-center">
            <div className="px-4 flex flex-col justify-center">
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                {totalAum > BigInt(0) ? formatCurrency(totalAum, STABLECOIN_DECIMALS) : '$0'}
              </div>
              <div className="text-sm font-medium text-mantle-green mb-1 uppercase tracking-wider">Total AUM</div>
              <div className="text-xs text-gray-500">Across all vaults</div>
            </div>
            <div className="px-4 flex flex-col justify-center">
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                {totalBadDebt > BigInt(0) ? '100%' : '0%'}
              </div>
              <div className="text-sm font-medium text-mantle-green mb-1 uppercase tracking-wider">Default Rate</div>
              <div className="text-xs text-gray-500">On-chain history</div>
            </div>
            <div className="px-4 flex flex-col justify-center">
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                {vaultCount > 0 ? `${vaultCount}` : '0'}
              </div>
              <div className="text-sm font-medium text-mantle-green mb-1 uppercase tracking-wider">Active Vaults</div>
              <div className="text-xs text-gray-500">Risk-tiered pools</div>
            </div>
            <div className="px-4 flex flex-col justify-center">
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                {totalDepositsAll > BigInt(0) ? formatCurrency(totalDepositsAll, STABLECOIN_DECIMALS) : '$0'}
              </div>
              <div className="text-sm font-medium text-mantle-green mb-1 uppercase tracking-wider">Total Deposits</div>
              <div className="text-xs text-gray-500">Investor capital</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const yOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const yHero = useTransform(scrollYProgress, [0, 0.2], [0, 100])

  return (
    <div className="relative min-h-screen font-sans" ref={containerRef}>
      <div className="fixed top-0 left-0 w-full h-[800px] bg-mantle-green/5 blur-[200px] -z-10 rounded-full mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 blur-[200px] -z-10 rounded-full mix-blend-screen pointer-events-none" />

      <section className="relative pt-32 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] -z-10 opacity-20"></div>

        <motion.div
          style={{ opacity: yOpacity, y: yHero }}
          className="max-w-7xl mx-auto text-center relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-mantle-green/30 bg-mantle-darker/60 backdrop-blur-md text-mantle-green text-sm font-semibold mb-10 shadow-[0_0_20px_rgba(0,220,130,0.1)]"
          >
            <Zap className="w-4 h-4 animate-pulse" />
            <span className="tracking-wide uppercase text-xs">RealFi on Mantle Network</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[1.1]"
          >
            <span className="text-white drop-shadow-2xl">Instant Liquidity.</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-mantle-green via-[#00fdf0] to-mantle-green">
              For SME Invoices
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            className="text-gray-400 text-lg md:text-2xl max-w-3xl mx-auto mb-14 leading-relaxed font-light"
          >
            The first decentralized financing system in Indonesia on the <strong className="text-white font-medium">Mantle Network</strong> ecosystem. Tokenize your invoices into high-value NFTs and get funded within 24 hours.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link href="/borrower">
              <Button size="lg" className="w-full sm:w-auto h-16 px-10 text-lg gap-3 group bg-gradient-to-r from-mantle-green to-emerald-400 text-black hover:shadow-[0_0_40px_rgba(0,220,130,0.4)] transition-all">
                Get Funded
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
            <Link href="/investor">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-16 px-10 text-lg gap-3 border-white/20 text-white hover:bg-white/5 hover:border-mantle-green transition-all">
                <Wallet className="w-5 h-5" />
                Start Investing
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <HeroStats />

      <section className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              Next-Generation <span className="text-transparent bg-clip-text bg-gradient-to-r from-mantle-green to-blue-500">DeFi Architecture</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl font-light">
              Leaving behind the limitations of conventional banking with transparent, secure, and permissionless blockchain technology.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Zero Physical Collateral",
                desc: "Your highly-valued client invoices are the only collateral needed. On-chain AI assesses credit risk instantly without manual checks.",
                icon: ShieldCheck,
                color: "from-blue-500 to-cyan-400"
              },
              {
                title: "Smart Contract Automation",
                desc: "The entire funding lifecycle, escrow, and payouts run autonomously on the Mantle Network. Ensuring lightning-fast disbursements without human intervention.",
                icon: Cpu,
                color: "from-mantle-green to-emerald-400"
              },
              {
                title: "Transparent Real Yield",
                desc: "All fund flows are permanently recorded on the blockchain. Investors earn high yields backed by real-world business cash flow assets.",
                icon: Activity,
                color: "from-purple-500 to-pink-500"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl blur-xl`} />
                <Card className="relative h-full border-white/10 bg-mantle-darker/80 hover:bg-mantle-darker/90 transition-all duration-500 p-8 rounded-3xl">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-gradient-to-br ${feature.color} bg-opacity-10 shadow-lg`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-mantle-green transition-colors">{feature.title}</h3>
                  <p className="text-gray-400 text-base leading-relaxed">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 overflow-hidden bg-black relative border-y border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,220,130,0.05),rgba(0,0,0,1))] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-gray-300 text-sm font-medium mb-8">
                <Coins className="w-4 h-4 text-mantle-green" />
                <span>RWA Liquidity Vaults</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
                Diversify with <br /><span className="italic font-light">Real World Assets.</span>
              </h2>
              <p className="text-gray-400 text-xl mb-10 leading-relaxed font-light">
                Gain measured risk exposure to financially healthy SME invoice financing. Earn fixed APYs backed by tangible cash flows.
              </p>

              <div className="space-y-6 mb-12">
                {['Audited Smart Contracts (Secured by Mantle)', 'Automated Daily Interest Distribution', 'Precise Risk Tiers (A-C Grades)'].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-mantle-green/20 flex items-center justify-center border border-mantle-green/30 shrink-0">
                      <ChevronRight className="w-5 h-5 text-mantle-green" />
                    </div>
                    <span className="text-gray-200 text-lg">{item}</span>
                  </div>
                ))}
              </div>

              <Link href="/investor">
                <Button className="h-14 px-8 text-lg gap-2 bg-white text-black hover:bg-gray-200 w-full sm:w-auto">
                  Access Vaults Now <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, type: "spring" }}
              className="relative perspective-1000"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-mantle-green via-cyan-400 to-blue-500 blur-3xl opacity-20 transform scale-90" />

              <Card className="relative border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h4 className="font-bold text-2xl text-white mb-2 tracking-tight">Prime Liquid Vault</h4>
                    <span className="px-3 py-1 rounded-full bg-mantle-green/10 text-mantle-green text-sm font-semibold border border-mantle-green/20">
                      Tier 1 Risk: Very Low
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">12.5%</div>
                    <div className="text-sm text-gray-400 mt-1 uppercase tracking-wider font-semibold">Target APY</div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex gap-4">
                    <Link href="/investor" className="w-full">
                      <Button className="w-full h-14 text-lg bg-mantle-green hover:bg-emerald-400 text-black border-none font-bold">Deposit USDC</Button>
                    </Link>
                    <Link href="/investor" className="w-full">
                      <Button className="w-full h-14 text-lg border-white/20 text-white hover:bg-white/10" variant="outline">View Details</Button>
                    </Link>
                  </div>
                </div>
              </Card>

              <motion.div
                animate={{ y: [-15, 15, -15], x: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 z-20"
              >
                <Card className="p-5 bg-[#111]/95 border-mantle-green/40 shadow-2xl backdrop-blur-xl rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mantle-green to-emerald-600 flex items-center justify-center shadow-lg">
                      <Coins className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Live on Mantle</div>
                      <div className="font-bold text-white text-xl">Invoice Financing</div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10 text-center px-6 bg-[#030303] relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image src="/logo.png" alt="TILV" width={32} height={32} className="rounded-lg" />
          <span className="font-extrabold text-2xl tracking-widest">TILV</span>
        </div>
        <p className="text-base text-gray-500 mb-8 max-w-md mx-auto font-light">Bring borderless on-chain liquidity to the real-world business economy.</p>
        <div className="flex gap-8 justify-center text-sm font-semibold uppercase tracking-wider">
          <Link href="#" className="text-gray-400 hover:text-mantle-green transition-colors">Twitter</Link>
          <Link href="#" className="text-gray-400 hover:text-mantle-green transition-colors">Discord</Link>
          <Link href="#" className="text-gray-400 hover:text-mantle-green transition-colors">Docs</Link>
          <Link href="#" className="text-gray-400 hover:text-mantle-green transition-colors">Mantle Network</Link>
        </div>
      </footer>
    </div>
  )
}
