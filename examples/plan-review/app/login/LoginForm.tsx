"use client";
import { useState } from "react";

const ACCOUNTS = [
  { user: "alice", tenant: "acme", label: "alice, Acme Manufacturing (approver)" },
  { user: "bob", tenant: "acme", label: "bob, Acme Manufacturing (planner)" },
  { user: "alice", tenant: "globex", label: "alice, Globex Foods (planner)" },
  { user: "bob", tenant: "globex", label: "bob, Globex Foods (approver)" },
];

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  async function signIn(user: string, tenant: string) {
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, tenant }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Sign-in failed.");
      return;
    }
    window.location.assign(next);
  }
  return (
    <div className="stack">
      {ACCOUNTS.map((a) => (
        <button key={`${a.user}-${a.tenant}`} onClick={() => signIn(a.user, a.tenant)}>
          Sign in as {a.label}
        </button>
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
