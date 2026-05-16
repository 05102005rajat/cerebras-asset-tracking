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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded"
        >
          Skip to main content
        </a>
        <header className="border-b bg-white sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <a href="/" className="font-semibold text-gray-900 whitespace-nowrap">
              Asset tracking
            </a>
            <RoleSwitcher />
            <div className="w-full sm:w-auto sm:flex-1 sm:flex sm:justify-center order-last sm:order-none">
              <PrimaryNav />
            </div>
          </div>
        </header>
        <main id="main" className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
