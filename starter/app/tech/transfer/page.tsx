export default function TechTransferPage() {
  return (
    <div className="p-2">
      <h1 className="text-2xl font-bold">Transfer custody (stub)</h1>
      <p className="text-gray-600 mt-2">
        Build the transfer workflow here. Scan the asset, then scan the
        receiving party&apos;s badge. The logged-in user is the &quot;from&quot;
        custodian — only the receiving side gets an explicit scan. State
        doesn&apos;t change; custodian does. See <code>docs/tips.md</code>.
      </p>
    </div>
  );
}
