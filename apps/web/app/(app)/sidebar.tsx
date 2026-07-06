"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = {
  href: string;
  label: string;
  accent?: string;
  icon: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  ),
  sleep: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
    </svg>
  ),
  recovery: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <path d="M2.5 10h3l2-4.5 3 9 2-4.5h5" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <path d="M3 16.5 8 10l3 3 6-8" />
      <path d="M13 5h4v4" />
    </svg>
  ),
  integrations: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <path d="M8.5 11.5 5 15a2.47 2.47 0 0 1-3.5-3.5L5 8" />
      <path d="M11.5 8.5 15 5a2.47 2.47 0 0 1 3.5 3.5L15 12" />
      <path d="M8 12l4-4" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" {...stroke}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.4 1.4M13.55 13.55l1.4 1.4M14.95 5.05l-1.4 1.4M6.45 13.55l-1.4 1.4" />
    </svg>
  ),
};

const MAIN: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/sleep", label: "Sleep", accent: "var(--sleep)", icon: ICONS.sleep },
  { href: "/recovery", label: "Recovery", accent: "var(--recovery)", icon: ICONS.recovery },
  { href: "/activity", label: "Activity", accent: "var(--activity)", icon: ICONS.activity },
];

const WORKSPACE: Item[] = [
  { href: "/integrations", label: "Integrations", icon: ICONS.integrations },
  { href: "/settings", label: "Settings", icon: ICONS.settings },
];

function NavItem({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-foreground/[.07] font-medium text-foreground"
          : "text-muted hover:bg-foreground/[.05] hover:text-foreground"
      }`}
    >
      <span style={active && item.accent ? { color: item.accent } : undefined}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function SidebarContent({
  email,
  signOut,
  onNavigate,
}: {
  email: string;
  signOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="mb-5 flex items-center gap-2 px-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--sleep), var(--recovery))" }}
        >
          V
        </span>
        <span className="font-display text-sm font-semibold tracking-tight">Vitalis</span>
      </div>

      <nav className="space-y-0.5">
        {MAIN.map((item) => (
          <NavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <p className="eyebrow mb-1.5 mt-6 px-2">Workspace</p>
      <nav className="space-y-0.5">
        {WORKSPACE.map((item) => (
          <NavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto border-t border-hairline pt-3">
        <p className="truncate px-2 text-xs text-faint">{email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-foreground/[.05] hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({ email, signOut }: { email: string; signOut: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close the mobile drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-hairline bg-sidebar md:block">
        <SidebarContent email={email} signOut={signOut} />
      </aside>

      {/* Mobile: slim top bar + drawer */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-hairline bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-1 text-muted hover:bg-foreground/[.05] hover:text-foreground"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke}>
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        <span className="font-display text-sm font-semibold tracking-tight">Vitalis</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-hairline bg-sidebar shadow-xl">
            <SidebarContent email={email} signOut={signOut} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
