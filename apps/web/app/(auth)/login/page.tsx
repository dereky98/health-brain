import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Health Agg" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Health Agg</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Every night and every mile, on one page
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted">
          Sleep, recovery, and training from WHOOP, Eight Sleep, and Strava.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
