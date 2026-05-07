import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'
import { mantle } from 'viem/chains'

const mantleTestnet = defineChain({
  id: 5001,
  name: 'Mantle Testnet',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MantleScan', url: 'https://explorer.testnet.mantle.xyz' },
  },
  testnet: true,
})

const chains = process.env.NEXT_PUBLIC_MAINNET === 'true'
  ? [mantle]
  : [mantleTestnet]

export const config = getDefaultConfig({
  appName: 'TILV',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains,
  ssr: true,
})
