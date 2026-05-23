export default function InvestorLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <div className="h-8 w-48 bg-mantle-light/50 rounded animate-pulse" />
          <div className="h-4 w-64 bg-mantle-light/30 rounded mt-2 animate-pulse" />
        </div>
        <div className="h-24 w-80 bg-mantle-light/20 rounded-2xl animate-pulse" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-mantle-darker/60 backdrop-blur-xl p-6 shadow-xl animate-pulse">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-xl bg-mantle-light/50" />
              <div className="text-right">
                <div className="h-8 w-16 bg-mantle-light/50 rounded" />
                <div className="h-3 w-12 bg-mantle-light/30 rounded mt-1" />
              </div>
            </div>
            <div className="h-6 w-32 bg-mantle-light/50 rounded mb-1" />
            <div className="h-4 w-20 bg-mantle-light/30 rounded mb-6" />
            <div className="mt-auto space-y-4">
              <div className="flex justify-between py-3 border-y border-white/5">
                <div className="h-4 w-8 bg-mantle-light/30 rounded" />
                <div className="h-4 w-20 bg-mantle-light/50 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="h-10 rounded-lg bg-mantle-light/50" />
                <div className="h-10 rounded-lg bg-mantle-light/30" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}