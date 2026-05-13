import Link from "next/link";

export default function TechLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Technician landing (stub)</h1>
        <p className="text-gray-600 mt-2">
          Build the tech home here — pick a workflow, see recent scans, quick
          links. See <code>docs/tips.md</code> for guidance.
        </p>
      </div>
      <ul className="space-y-2">
        <li>
          <Link className="text-blue-700 hover:underline" href="/tech/receive">
            Receive
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/tech/store">
            Store
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/tech/deploy">
            Deploy
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/tech/transfer">
            Transfer custody
          </Link>
        </li>
      </ul>
    </div>
  );
}
