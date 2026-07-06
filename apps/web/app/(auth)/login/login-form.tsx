"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  const state = mode === "signin" ? signInState : signUpState;
  const pending = mode === "signin" ? signInPending : signUpPending;

  const inputClass =
    "w-full rounded-md border border-hairline bg-card px-3 py-2 text-sm outline-none focus:border-foreground";

  return (
    <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button type="button" className="underline" onClick={() => setMode("signup")}>
              Sign up
            </button>
          </>
        ) : (
          <>
            Have an account?{" "}
            <button type="button" className="underline" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}
