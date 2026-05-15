export default function AssetDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded-lg" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="h-36 bg-gray-200 rounded-lg" />
        <div className="h-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-48 bg-gray-200 rounded-lg" />
    </div>
  );
}
