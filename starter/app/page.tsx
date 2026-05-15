import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          Asset tracking
        </h1>
        <p className="text-gray-600 mt-3 max-w-2xl">
          A multi-site research lab tracks instruments across three systems
          that disagree by default. This UI is the place techs and managers
          come to keep them aligned.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Card
          href="/tech"
          tone="blue"
          title="Tech"
          body="Receive, store, deploy, transfer. Built for one hand on a phone."
          ctaLabel="Open scan workflows →"
        />
        <Card
          href="/manager"
          tone="emerald"
          title="Manager"
          body="The 8:55am pre-standup view: which assets need a human, what changed last night."
          ctaLabel="Open dashboard →"
        />
        <Card
          href="/manager/reconcile"
          tone="amber"
          title="Reconcile"
          body="Where ops, facilities, and finance disagree — categorized so you can act, not diff."
          ctaLabel="See the report →"
        />
        <Card
          href="/dev/barcodes"
          tone="violet"
          title="Test barcodes"
          body="Print or pull up scannable Code 128 strips for assets, locations, and badges."
          ctaLabel="Print sheet →"
        />
      </section>

      <section className="text-xs text-gray-500 border-t pt-4 space-y-1">
        <div>
          Use the{" "}
          <span className="font-medium text-gray-700">role switcher</span> in
          the header to toggle between <code>tech-jane</code> and{" "}
          <code>manager-paul</code>. The current role attaches to every scan
          server-side.
        </div>
        <div>
          Brief at{" "}
          <Link className="underline" href="/dev/barcodes">
            /dev/barcodes
          </Link>{" "}
          — print, scan, repeat.
        </div>
      </section>
    </div>
  );
}

function Card({
  href,
  tone,
  title,
  body,
  ctaLabel,
}: {
  href: string;
  tone: "blue" | "emerald" | "amber" | "violet";
  title: string;
  body: string;
  ctaLabel: string;
}) {
  const accent = {
    blue: "border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900",
    emerald:
      "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900",
    violet:
      "border-violet-200 bg-violet-50/50 hover:bg-violet-50 text-violet-900",
  }[tone];

  return (
    <Link
      href={href}
      className={`block border rounded-lg p-5 transition ${accent}`}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-gray-700 mt-1.5">{body}</p>
      <div className="text-sm font-medium mt-3">{ctaLabel}</div>
    </Link>
  );
}
