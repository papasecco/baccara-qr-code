"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/scan";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      setError("Password errata");
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "64px 20px" }}>
      <h1 style={{ textAlign: "center" }}>Accesso staff</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{ padding: 14, borderRadius: 10, border: "1px solid #3f3f46", background: "#18181b", color: "#f4f4f5", fontSize: 16 }}
        />
        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 14, borderRadius: 10, border: "none", background: "#22c55e", color: "#052e16", fontWeight: 600, fontSize: 16 }}
        >
          {loading ? "..." : "Entra"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
