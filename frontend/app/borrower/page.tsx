'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WalletGate } from '@/components/ui/WalletGate'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import React, { useRef, useState, DragEvent, ChangeEvent } from 'react'
import axios from 'axios'

const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:5000'
const MAX_FILE_SIZE_MB = 10
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const ACCEPTED_EXTS = '.pdf,.png,.jpg,.jpeg'

interface RiskResult {
    risk_score: number
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
    risk_factors: string[]
}

interface UploadResponse {
    success: boolean
    data: Record<string, unknown>
    validation: Record<string, unknown>
    risk_score: RiskResult
}

const TIER_MAP: Record<string, { name: string; apy: string; advance: string; color: string }> = {
    LOW: { name: 'Prime Vault', apy: '4–6%', advance: '80%', color: 'text-blue-400' },
    MEDIUM: { name: 'Growth Vault', apy: '8–12%', advance: '75%', color: 'text-mantle-green' },
    HIGH: { name: 'Emerging Vault', apy: '15–25%', advance: '70%', color: 'text-purple-400' },
}

export default function BorrowerDashboard() {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [amount, setAmount] = useState('')
    const [dueDays, setDueDays] = useState('30')
    const [dragging, setDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<UploadResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    function validateFile(f: File): string | null {
        if (!ACCEPTED_TYPES.includes(f.type)) {
            return 'Only PDF, PNG, JPG, and JPEG files are accepted.'
        }
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return `File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`
        }
        return null
    }

    function pickFile(f: File) {
        const err = validateFile(f)
        if (err) { setError(err); return }
        setFile(f)
        setError(null)
        setResult(null)
    }

    function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        if (f) pickFile(f)
    }

    function onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) pickFile(f)
    }

    function onDragOver(e: DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setDragging(true)
    }

    function onDragLeave() {
        setDragging(false)
    }

    async function handleSubmit() {
        if (!file) { setError('Please select an invoice file before submitting.'); return }
        setIsLoading(true)
        setError(null)
        setResult(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const { data } = await axios.post<UploadResponse>(
                `${AI_ENGINE_URL}/process-invoice`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            )
            setResult(data)
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || err.message || 'Upload failed.')
            } else {
                setError('An unexpected error occurred.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <WalletGate>
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-mantle">Borrower Dashboard</h1>
                    <p className="text-gray-400 mt-2">Upload your invoice and get funded within 24 hours</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-mantle-green/20">
                            <h2 className="text-xl font-bold mb-6">Submit New Invoice</h2>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_EXTS}
                                className="hidden"
                                onChange={onFileInputChange}
                            />

                            <div
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer bg-white/5 ${
                                    dragging
                                        ? 'border-mantle-green/70 bg-mantle-green/5'
                                        : file
                                        ? 'border-mantle-green/50'
                                        : 'border-white/10 hover:border-mantle-green/50'
                                }`}
                            >
                                <div className="w-16 h-16 rounded-full bg-mantle-green/10 flex items-center justify-center mb-4">
                                    {file ? <FileText className="w-8 h-8 text-mantle-green" /> : <Upload className="w-8 h-8 text-mantle-green" />}
                                </div>
                                {file ? (
                                    <>
                                        <h3 className="text-lg font-medium text-white mb-1">{file.name}</h3>
                                        <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB — click to change</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-lg font-medium text-white mb-2">Upload Invoice Document</h3>
                                        <p className="text-sm text-gray-400 max-w-sm mb-6">Drag & drop high-resolution PDF or image files (max. 10MB) here</p>
                                        <Button onClick={(e: React.MouseEvent) => { e.stopPropagation(); fileInputRef.current?.click() }}>Select File</Button>
                                    </>
                                )}
                            </div>

                            {error && (
                                <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                                </div>
                            )}

                            <div className="mt-6 flex flex-col gap-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Invoice Amount (USD)</label>
                                        <input
                                            type="text"
                                            placeholder="Example: 50,000"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-mantle-darker border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mantle-green focus:ring-1 focus:ring-mantle-green/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Due Date (Days)</label>
                                        <select
                                            value={dueDays}
                                            onChange={(e) => setDueDays(e.target.value)}
                                            className="w-full bg-mantle-darker border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mantle-green focus:ring-1 focus:ring-mantle-green/50"
                                        >
                                            <option value="30">30 Days</option>
                                            <option value="60">60 Days</option>
                                            <option value="90">90 Days</option>
                                        </select>
                                    </div>
                                </div>
                                <Button
                                    className="w-full mt-4"
                                    size="lg"
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Analyzing Invoice...' : 'Submit for AI & Smart Contract Confirmation'}
                                </Button>
                            </div>
                        </Card>

                        {result && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <Card className="border-mantle-green/30 bg-gradient-to-br from-mantle-dark to-[#001f14]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <CheckCircle className="w-6 h-6 text-mantle-green" />
                                        <h2 className="text-xl font-bold text-white">AI Risk Assessment Complete</h2>
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                            <div className="text-4xl font-black text-white mb-1">{result.risk_score.risk_score}</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider">Risk Score</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                            <div className={`text-2xl font-bold mb-1 ${TIER_MAP[result.risk_score.risk_level]?.color ?? 'text-white'}`}>
                                                {result.risk_score.risk_level}
                                            </div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider">Risk Level</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                            <div className="text-xl font-bold text-white mb-1">
                                                {TIER_MAP[result.risk_score.risk_level]?.name ?? '—'}
                                            </div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider">Assigned Vault</div>
                                        </div>
                                    </div>

                                    {TIER_MAP[result.risk_score.risk_level] && (
                                        <div className="grid md:grid-cols-2 gap-4 mb-6 text-sm">
                                            <div className="flex justify-between p-3 rounded-lg bg-white/5">
                                                <span className="text-gray-400">Estimated APY</span>
                                                <span className="font-semibold text-white">{TIER_MAP[result.risk_score.risk_level].apy}</span>
                                            </div>
                                            <div className="flex justify-between p-3 rounded-lg bg-white/5">
                                                <span className="text-gray-400">Advance Rate</span>
                                                <span className="font-semibold text-white">{TIER_MAP[result.risk_score.risk_level].advance}</span>
                                            </div>
                                        </div>
                                    )}

                                    {result.risk_score.risk_factors.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-400 mb-3">Risk Factors</p>
                                            <ul className="space-y-2">
                                                {result.risk_score.risk_factors.map((factor, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                        <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                                        {factor}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        )}
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
        </WalletGate>
    )
}
