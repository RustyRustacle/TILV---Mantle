'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ReactNode, useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'

export function WalletGate({ children }: { children: ReactNode }) {
    const { isConnected, status } = useAccount()
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    if (!mounted || status === 'reconnecting') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-mantle-light/50" />
                    <div className="h-4 w-48 bg-mantle-light/50 rounded" />
                    <div className="h-3 w-32 bg-mantle-light/50 rounded" />
                </div>
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6">
                <div className="w-20 h-20 rounded-full bg-mantle-green/10 flex items-center justify-center border border-mantle-green/20">
                    <Wallet className="w-10 h-10 text-mantle-green" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-gray-400 max-w-sm">You need to connect your wallet to access this feature.</p>
                </div>
                <ConnectButton />
            </div>
        )
    }

    return <>{children}</>
}
