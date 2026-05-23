export default function BorrowerLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-pulse">
      <div className="mb-10">
        <div className="h-8 w-56 bg-mantle-light/50 rounded" />
        <div className="h-4 w-72 bg-mantle-light/30 rounded mt-2" />
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-mantle-darker/60 backdrop-blur-xl p-6 shadow-xl">
            <div className="h-6 w-48 bg-mantle-light/50 rounded mb-6" />
            <div className="border-2 border-dashed rounded-xl p-10 bg-white/5 border-white/10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-mantle-light/50" />
              <div className="h-5 w-44 bg-mantle-light/50 rounded" />
              <div className="h-4 w-64 bg-mantle-light/30 rounded" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-mantle-darker/60 backdrop-blur-xl p-6 shadow-xl">
            <div className="h-5 w-36 bg-mantle-light/50 rounded mb-4" />
            <div className="h-20 bg-mantle-light/20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}