'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

export default function BorrowerDashboard() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="mb-10">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-mantle">Borrower Dashboard</h1>
                <p className="text-gray-400 mt-2">Upload your invoice and get funded within 24 hours</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-mantle-green/20">
                        <h2 className="text-xl font-bold mb-6">Submit New Invoice</h2>

                        <div className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-mantle-green/50 transition-colors cursor-pointer bg-white/5">
                            <div className="w-16 h-16 rounded-full bg-mantle-green/10 flex items-center justify-center mb-4">
                                <Upload className="w-8 h-8 text-mantle-green" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Upload Invoice Document</h3>
                            <p className="text-sm text-gray-400 max-w-sm mb-6">Drag & drop high-resolution PDF or image files (max. 10MB) here</p>
                            <Button>Select File</Button>
                        </div>

                        <div className="mt-6 flex flex-col gap-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Invoice Amount (USD)</label>
                                    <input
                                        type="text"
                                        placeholder="Example: 50,000"
                                        className="w-full bg-mantle-darker border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mantle-green focus:ring-1 focus:ring-mantle-green/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Due Date (Days)</label>
                                    <select className="w-full bg-mantle-darker border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mantle-green focus:ring-1 focus:ring-mantle-green/50">
                                        <option>30 Days</option>
                                        <option>60 Days</option>
                                        <option>90 Days</option>
                                    </select>
                                </div>
                            </div>
                            <Button className="w-full mt-4" size="lg">Submit for AI & Smart Contract Confirmation</Button>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold text-lg mb-4 text-white">Recent Submissions</h3>
                        <div className="space-y-4 text-sm">
                            <div className="p-4 rounded-lg bg-mantle-darker border border-white/5 flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-mantle-green shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-white">INV-2023-001 <span className="text-xs font-normal text-gray-400 ml-2">Awaiting Funding</span></div>
                                    <div className="text-gray-400 mt-1">Value: $15,000</div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div className="bg-mantle-green w-[45%] h-full" />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Funded 45% from Mantle Network pool</div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-mantle-darker border border-white/5 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-white">INV-2023-002 <span className="text-xs font-normal text-gray-400 ml-2">AI Verification</span></div>
                                    <div className="text-gray-400 mt-1">Document is being analyzed by scoring machine...</div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-mantle-dark to-[#002B19] border-mantle-green/30">
                        <h3 className="font-bold text-white mb-2">Your Credit Limit</h3>
                        <div className="text-3xl font-extrabold text-mantle-green mb-1">$50,000</div>
                        <p className="text-xs text-gray-400 mb-4">Backed by on-chain reputation (Score: 850/A+)</p>
                        <Button variant="outline" className="w-full text-xs" size="sm">Increase Limit</Button>
                    </Card>
                </div>
            </div>
        </div>
    )
}
