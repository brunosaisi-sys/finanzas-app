export default function CuotasLoading() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-lg w-48 mt-2" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
