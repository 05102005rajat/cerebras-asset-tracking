"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getRole, setRole, type Role } from "@/lib/auth";

// The role lives in a cookie that server components also read (via
// lib/server-auth.ts) — so after we flip it client-side, we ask the router
// to re-render the current page so any server data (the user_id stamped on
// future scans, etc.) reflects the new role. router.refresh() is cheaper
// and faster than window.location.reload() — it re-runs the server
// component without dropping client state below us.
export function RoleSwitcher() {
  const [role, setRoleState] = useState<Role>("tech");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setRoleState(getRole());
  }, []);

  function handleClick(): void {
    const next: Role = role === "tech" ? "manager" : "tech";
    setRole(next);
    setRoleState(next);
    // If the user is on a tech page and switches to manager (or vice versa),
    // route them to the new role's home — they almost certainly clicked the
    // switcher to go *do* something on the other side, and dumping them back
    // onto a page that no longer fits saves a click.
    if (pathname?.startsWith("/tech") && next === "manager") {
      router.push("/manager");
    } else if (pathname?.startsWith("/manager") && next === "tech") {
      router.push("/tech");
    } else {
      router.refresh();
    }
  }

  const fullLabel =
    role === "tech" ? "Switch to manager view" : "Switch to tech view";
  const shortLabel = role === "tech" ? "→ Manager" : "→ Tech";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 min-h-[44px] whitespace-nowrap"
      aria-label={fullLabel}
    >
      <span className="text-gray-500 mr-2 hidden sm:inline">role: {role}</span>
      <span className="font-medium hidden sm:inline">{fullLabel}</span>
      <span className="font-medium sm:hidden">{shortLabel}</span>
    </button>
  );
}
