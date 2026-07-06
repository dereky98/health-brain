"use client";

import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey, type ApiKeyRow } from "./api-key-actions";

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ApiKeys({ keys, mcpUrl }: { keys: ApiKeyRow[]; mcpUrl: string }) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "command" | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const { token } = await createApiKey(name || "Claude");
        setNewToken(token);
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not create key");
      }
    });
  }

  function revoke(id: string) {
    if (!confirm("Revoke this key? Anything using it will stop working.")) return;
    startTransition(async () => {
      await revokeApiKey(id);
    });
  }

  async function copy(text: string, which: "token" | "command") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  const claudeCommand = newToken
    ? `claude mcp add --transport http health-agg ${mcpUrl} --header "Authorization: Bearer ${newToken}"`
    : null;

  return (
    <div className="mt-6 rounded-xl border border-hairline bg-card p-5">
      <h2 className="text-sm font-medium">Claude access</h2>
      <p className="mt-1 text-xs text-muted">
        Personal access keys let Claude query your data and trigger syncs through the MCP server
        at <span className="metric">{mcpUrl}</span>. A key grants access to your data only.
      </p>

      {newToken && (
        <div className="mt-4 rounded-lg border border-hairline bg-background p-4">
          <p className="text-xs font-medium">Your new key — copy it now, it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="metric flex-1 overflow-x-auto rounded-md border border-hairline bg-card px-2.5 py-1.5 text-xs">
              {newToken}
            </code>
            <button
              onClick={() => copy(newToken, "token")}
              className="shrink-0 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-medium hover:bg-card"
            >
              {copied === "token" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-xs font-medium">Add it to Claude Code:</p>
          <div className="mt-1.5 flex items-start gap-2">
            <code className="metric flex-1 overflow-x-auto whitespace-pre rounded-md border border-hairline bg-card px-2.5 py-1.5 text-[11px] leading-relaxed">
              {claudeCommand}
            </code>
            <button
              onClick={() => copy(claudeCommand!, "command")}
              className="shrink-0 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-medium hover:bg-card"
            >
              {copied === "command" ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewToken(null)} className="mt-3 text-xs text-muted underline">
            Done — hide the key
          </button>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span>{k.name}</span>
                <span className="metric ml-2 text-xs text-faint">{k.key_prefix}…</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-faint">
                  created {fmtDate(k.created_at)} · last used {fmtDate(k.last_used_at)}
                </span>
                <button
                  onClick={() => revoke(k.id)}
                  disabled={pending}
                  className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. Claude on my laptop)"
          className="flex-1 rounded-md border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        <button
          onClick={create}
          disabled={pending}
          className="rounded-md bg-foreground px-3.5 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create key"}
        </button>
      </div>
    </div>
  );
}
