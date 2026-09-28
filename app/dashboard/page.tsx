"use client";

import { useEffect, useState } from "react";

type EventStat = {
  event_id: string;
  event_name: string;
  is_active: boolean;
  total_registered: number;
  total_scanned: number;
  total_valid: number;
  total_void: number;
};

type StatsResponse = {
  events: EventStat[];
  totals: { total_registered: number; total_scanned: number };
};

export default function DashboardPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("errore " + res.status);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    }

    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ fontSize: 22 }}>Dashboard live</h1>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {data && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              padding: 20,
              borderRadius: 14,
              background: "#18181b",
            }}
          >
            <Stat label="Iscritti totali" value={data.totals.total_registered} />
            <Stat label="Entrati" value={data.totals.total_scanned} accent="#22c55e" />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#a1a1aa", fontSize: 13 }}>
                <th style={{ padding: "8px 4px" }}>PR / Typeform</th>
                <th style={{ padding: "8px 4px" }}>Iscritti</th>
                <th style={{ padding: "8px 4px" }}>Entrati</th>
                <th style={{ padding: "8px 4px" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev) => {
                const pct = ev.total_registered > 0 ? Math.round((ev.total_scanned / ev.total_registered) * 100) : 0;
                return (
                  <tr key={ev.event_id} style={{ borderTop: "1px solid #27272a" }}>
                    <td style={{ padding: "10px 4px" }}>
                      {ev.event_name}
                      {!ev.is_active && <span style={{ color: "#71717a", fontSize: 12 }}> (disattivo)</span>}
                    </td>
                    <td style={{ padding: "10px 4px" }}>{ev.total_registered}</td>
                    <td style={{ padding: "10px 4px", color: "#22c55e", fontWeight: 600 }}>{ev.total_scanned}</td>
                    <td style={{ padding: "10px 4px" }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent ?? "#f4f4f5" }}>{value}</div>
      <div style={{ color: "#a1a1aa", fontSize: 13 }}>{label}</div>
    </div>
  );
}
