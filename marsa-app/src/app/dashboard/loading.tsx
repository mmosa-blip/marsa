export default function DashboardLoading() {
  return (
    <div className="p-8 animate-pulse" dir="rtl">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-48 rounded-lg" style={{ backgroundColor: "#E8E6F0" }} />
          <div className="h-4 w-32 rounded-lg mt-2" style={{ backgroundColor: "#E8E6F0" }} />
        </div>
        <div className="h-10 w-28 rounded-xl" style={{ backgroundColor: "#E8E6F0" }} />
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl p-5 h-28" style={{ backgroundColor: "#E8E6F0" }} />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
        <div className="h-12" style={{ backgroundColor: "#D5D3CB" }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-b" style={{ borderColor: "#E8E6F0", backgroundColor: i % 2 === 0 ? "#F5F3ED" : "#FAFAFE" }} />
        ))}
      </div>
    </div>
  );
}
