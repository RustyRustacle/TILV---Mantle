'use client'

import Link from 'next/link'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { useState, useEffect } from 'react'

export function Navbar() {
    const { address, isConnected } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const [scrolled, setScrolled] = useState(false)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-mantle-darker/80 backdrop-blur-lg border-b border-white/5 py-4'
                : 'bg-transparent py-6'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-mantle-dark flex items-center justify-center border border-white/10 group-hover:border-mantle-green/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        <span className="text-mantle-green font-bold text-xl drop-shadow-[0_0_8px_rgba(0,220,130,0.8)]">T</span>
                    </div>
                    <span className="font-bold text-xl text-white tracking-widest">TILV</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <Link href="/#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it Works</Link>
                    <Link href="/#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</Link>
                    <Link href="/investor" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Vaults</Link>
                </div>

                <div className="flex items-center gap-4">
                    {isClient && (
                        <AnimatePresence mode="popLayout">
                            {isConnected ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex items-center gap-4"
                                >
                                    <div className="px-4 py-2 rounded-lg bg-mantle-dark border border-white/10 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-mantle-green animate-pulse" />
                                        <span className="text-sm font-mono text-gray-300">
                                            {address?.slice(0, 6)}...{address?.slice(-4)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => disconnect()}
                                        className="text-sm text-gray-400 hover:text-red-400 transition-colors"
                                    >
                                        Disconnect
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <Button
                                        onClick={() => connect({ connector: connectors[0] })}
                                        variant="solid"
                                    >
                                        Connect Wallet
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </motion.nav>
    )
}
