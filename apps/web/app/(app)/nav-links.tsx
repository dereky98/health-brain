"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: Array<{ href: string; label: string; accent?: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sleep", label: "Sleep", accent: "var(--sleep)" },
  { href: "/recovery", label: "Recovery", accent: "var(--recovery)" },
  { href: "/activity", label: "Activity", accent: "var(--activity)" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              active ? "text-foreground" : "text-muted hover:bg-card hover:text-foreground"
            }`}
          >
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-2.5 -bottom-[9px] h-0.5 rounded-full"
                style={{ backgroundColor: item.accent ?? "var(--foreground)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
