import { getDefaultConfig, type Chain } from '@rainbow-me/rainbowkit'
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

const chains: [Chain, ...Chain[]] = process.env.NEXT_PUBLIC_MAINNET === 'true'
  ? [mantle as Chain]
  : [mantleTestnet as Chain]

function getProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  if (!id && typeof window !== 'undefined') {
    console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
    return ''
  }
  return id ?? ''
}

export const config = getDefaultConfig({
  appName: 'TILV',
  projectId: getProjectId(),
  chains,
  ssr: true,
})
