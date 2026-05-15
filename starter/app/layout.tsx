import type { Metadata } from "next";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { PrimaryNav } from "@/components/PrimaryNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset tracking",
  description:
    "Lab equipment asset tracking — scan workflows for techs and a reconciliation dashboard for managers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <a href="/" className="font-semibold text-gray-900 whitespace-nowrap">
              Asset tracking
            </a>
            <PrimaryNav />
            <RoleSwitcher />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
