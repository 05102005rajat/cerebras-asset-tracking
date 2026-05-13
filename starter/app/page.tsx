import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold">Asset tracking challenge</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          You&apos;re looking at the starter. The hosted API runs separately and is
          already populated with about a thousand assets, plus mock facilities and finance
          data. Use the role switcher in the header to act as either a lab
          technician (mobile) or an asset manager (desktop).
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-xl font-semibold">Technician</h2>
          <p className="text-gray-600 text-sm mt-1">
            Mobile scan workflows. Build these first.
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link className="text-blue-700 hover:underline" href="/tech">
                /tech &nbsp;— landing
              </Link>
            </li>
            <li>
              <Link className="text-blue-700 hover:underline" href="/tech/receive">
                /tech/receive
              </Link>
            </li>
            <li>
              <Link className="text-blue-700 hover:underline" href="/tech/store">
                /tech/store
              </Link>
            </li>
            <li>
              <Link className="text-blue-700 hover:underline" href="/tech/deploy">
                /tech/deploy
              </Link>
            </li>
            <li>
              <Link className="text-blue-700 hover:underline" href="/tech/transfer">
                /tech/transfer
              </Link>
            </li>
          </ul>
        </div>

        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-xl font-semibold">Manager</h2>
          <p className="text-gray-600 text-sm mt-1">
            Desktop dashboard. Build after the scan workflows.
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link className="text-blue-700 hover:underline" href="/manager">
                /manager &nbsp;— landing
              </Link>
            </li>
            <li>
              <Link
                className="text-blue-700 hover:underline"
                href="/manager/reconcile"
              >
                /manager/reconcile
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold">Before you start</h2>
        <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm text-gray-700">
          <li>
            Make sure the API is running (<code>pnpm dev</code> from the
            monorepo root brings up both).
          </li>
          <li>
            Read <code>starter/docs/api-reference.md</code> and{" "}
            <code>starter/docs/tips.md</code>.
          </li>
          <li>
            Read the full brief at <code>docs/CHALLENGE.md</code> in the
            monorepo.
          </li>
        </ol>
      </section>
    </div>
  );
}
