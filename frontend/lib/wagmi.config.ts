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

let _config: ReturnType<typeof getDefaultConfig> | null = null

export function getConfig() {
  if (_config) return _config
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  if (!projectId) {
    console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
    return null
  }
  _config = getDefaultConfig({
    appName: 'TILV',
    projectId,
    chains,
    ssr: true,
  })
  return _config
}
