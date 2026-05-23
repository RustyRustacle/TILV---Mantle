'use client'

export default function BorrowerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Borrower dashboard error</h2>
        <p className="text-gray-400 max-w-md">{error.message || 'Something went wrong loading the dashboard.'}</p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 h-12 px-8 text-base bg-mantle-green text-black hover:bg-opacity-90 shadow-[0_0_15px_rgba(0,220,130,0.3)]"
      >
        Try again
      </button>
    </div>
  )
}