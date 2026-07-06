import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Health Agg" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 font-display text-2xl font-semibold tracking-tight">
          Vitalis Health Brain
        </h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
