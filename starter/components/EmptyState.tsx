export function EmptyState({
  icon = "·",
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <div className="text-2xl text-gray-400 mb-2" aria-hidden>
        {icon}
      </div>
      <div className="font-semibold text-gray-900">{title}</div>
      {body ? <div className="text-sm text-gray-600 mt-1">{body}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
