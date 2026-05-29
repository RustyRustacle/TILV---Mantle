'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useEffect } from 'react'

export function Navbar() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? 'bg-mantle-darker/80 backdrop-blur-lg border-b border-white/5 py-4'
                    : 'bg-transparent py-6'
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-1 group">
                    <Image
                        src="/logo.png"
                        alt="TILV"
                        width={40}
                        height={40}
                        className="rounded-xl"
                        priority
                    />
                    <span className="font-bold text-xl text-white tracking-widest">TILV</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <Link href="/" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Home</Link>
                    <Link href="/borrower" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Borrow</Link>
                    <Link href="/investor" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Vaults</Link>
                </div>

                <div className="flex items-center gap-4">
                    <ConnectButton />
                </div>
            </div>
        </nav>
    )
}