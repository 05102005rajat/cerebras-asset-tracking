// Skeleton-on-navigation: when the manager clicks a filter or sort, this
// renders instantly while the server fetches the new slice. Keeps the
// previously-loaded UI from feeling stuck.
export default function ManagerLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded" />
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="h-12 bg-gray-200 rounded-lg" />
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 border-b border-gray-100 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
