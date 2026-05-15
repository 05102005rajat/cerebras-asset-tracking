"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/tech", label: "Tech" },
  { href: "/manager", label: "Manager" },
  { href: "/manager/reconcile", label: "Reconcile" },
  { href: "/dev/barcodes", label: "Barcodes" },
];

export function PrimaryNav() {
  const path = usePathname() ?? "/";
  return (
    <nav className="flex items-center gap-1 text-sm">
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? path === "/"
            : path === item.href ||
              (path.startsWith(item.href + "/") && item.href !== "/manager");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2 py-1 rounded ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
