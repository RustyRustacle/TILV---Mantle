'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getConfig } from '@/lib/wagmi.config'
import { ReactNode, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())
    const config = getConfig()

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white px-6">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-6">⚠</div>
                    <h2 className="text-2xl font-bold mb-3">Configuration Missing</h2>
                    <p className="text-gray-400 mb-6">
                        <code className="text-mantle-green">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> is not set.
                        Please add it to your environment variables and reload.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme({ accentColor: '#00DC82', accentColorForeground: '#000' })}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
