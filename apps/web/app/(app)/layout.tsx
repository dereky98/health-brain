import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} signOut={signOut} />
      <main className="px-4 py-6 md:ml-60 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
