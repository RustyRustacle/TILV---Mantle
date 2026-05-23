import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-mantle-green to-emerald-400">404</div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
        <p className="text-gray-400 max-w-md">The page you are looking for does not exist or has been moved.</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 h-12 px-8 text-base bg-mantle-green text-black hover:bg-opacity-90 shadow-[0_0_15px_rgba(0,220,130,0.3)]"
      >
        Go home
      </Link>
    </div>
  )
}