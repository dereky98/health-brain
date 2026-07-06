import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-5">
            <span
              className="font-display text-sm font-bold uppercase tracking-tight"
              style={{ fontVariationSettings: "'wdth' 125" }}
            >
              Health&nbsp;Agg
            </span>
            <NavLinks />
          </div>
          <form action={signOut}>
            <button type="submit" className="text-xs text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
