export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-mantle-green/30 border-t-mantle-green animate-spin" />
        <p className="text-gray-400 text-sm">Loading TILV...</p>
      </div>
    </div>
  )
}