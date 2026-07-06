"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PROVIDERS } from "@/lib/providers";

export function FlashBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const connected = params.get("connected");
  const error = params.get("error");
  if (!connected && !error) return null;

  const providerName = PROVIDERS.find((p) => p.slug === connected)?.name ?? connected;

  return (
    <div
      className={`mt-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
        connected
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
          : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
      }`}
    >
      <span>
        {connected
          ? `${providerName} connected — your history is syncing now.`
          : `Connection failed: ${error!.replaceAll("_", " ")}`}
      </span>
      <button onClick={() => router.replace("/integrations")} className="text-xs underline">
        Dismiss
      </button>
    </div>
  );
}
