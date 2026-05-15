export default function ReconcileLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-6 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-80 bg-gray-200 rounded mt-2" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-gray-200 rounded-lg" />
    </div>
  );
}
