import Link from "next/link";

const WORKFLOWS = [
  {
    href: "/tech/receive",
    title: "Receive",
    body: "First scan when something arrives at the dock.",
    accent: "bg-blue-600",
  },
  {
    href: "/tech/store",
    title: "Store",
    body: "Move into storage, or pull off a rack.",
    accent: "bg-amber-600",
  },
  {
    href: "/tech/deploy",
    title: "Deploy",
    body: "Rack and put into service.",
    accent: "bg-emerald-600",
  },
  {
    href: "/tech/transfer",
    title: "Transfer",
    body: "Hand custody to another tech.",
    accent: "bg-violet-600",
  },
] as const;

export default function TechLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pick a workflow</h1>
        <p className="text-gray-600 mt-1 text-sm">
          One scan at a time. Tap a card or use the URL.
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WORKFLOWS.map((w) => (
          <li key={w.href}>
            <Link
              href={w.href}
              className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${w.accent}`}
                  aria-hidden
                />
                <div className="font-semibold text-gray-900">{w.title}</div>
              </div>
              <div className="text-sm text-gray-600 mt-2">{w.body}</div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-500 border-t pt-4">
        Need test barcodes?{" "}
        <Link className="text-blue-700 hover:underline" href="/dev/barcodes">
          Print scannable assets and locations
        </Link>
        .
      </div>
    </div>
  );
}
