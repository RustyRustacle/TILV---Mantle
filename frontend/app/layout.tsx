import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TILV - Tokenized Invoice Liquidity Vault',
  description: 'Invoice financing platform on Mantle Network - Access instant liquidity or earn stable yields',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className} bg-[#050505] text-white selection:bg-mantle-green selection:text-black overflow-x-hidden`}>
        <div className="absolute top-0 z-[-2] h-screen w-screen bg-[#050505] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,220,130,0.15),rgba(255,255,255,0))]"></div>
        <Providers>
          <Navbar />
          <main className="pt-24 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
