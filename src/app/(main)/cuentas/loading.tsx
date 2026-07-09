export default function Loading() {
  return (
    <div className="p-4 max-w-lg mx-auto animate-pulse">
      <div className="flex items-center justify-between pt-2 mb-6">
        <div className="h-7 w-24 bg-gray-200 rounded-lg" />
        <div className="h-8 w-28 bg-gray-200 rounded-lg" />
      </div>
      <div className="space-y-6">
        {[1, 2].map((group) => (
          <div key={group}>
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center px-4 py-4 border-t first:border-t-0 border-gray-100">
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
