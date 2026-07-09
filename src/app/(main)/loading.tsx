export default function Loading() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between pt-2">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-gray-200 rounded-lg" />
          <div className="h-3 w-40 bg-gray-100 rounded" />
        </div>
        <div className="h-8 w-20 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between px-4 py-3 border-t first:border-t-0 border-gray-100">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0 border-gray-100">
              <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
