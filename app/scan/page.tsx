"use client";

import { useEffect, useRef, useState } from "react";

type CheckinResult = {
  result: "ok" | "already_scanned" | "not_found" | "void";
  full_name?: string;
  email?: string;
  event_name?: string;
  scanned_at?: string;
};

export default function ScanPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled || !containerRef.current) return;
      const scanner = new Html5Qrcode(containerRef.current.id);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText: string) => {
            if (busyRef.current) return;
            busyRef.current = true;
            setBusy(true);
            try {
              const res = await fetch("/api/checkin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: decodedText }),
              });
              const data = await res.json();
              setLastResult(data);
              setError(null);
            } catch (e) {
              setError("Errore di rete, riprova");
            } finally {
              // Piccola pausa prima di accettare un nuovo scan, per evitare doppie letture dello stesso QR
              setTimeout(() => {
                busyRef.current = false;
                setBusy(false);
              }, 1500);
            }
          },
          () => {
            // ignora i frame senza QR rilevato
          }
        )
        .catch((err: any) => {
          setError("Impossibile accedere alla fotocamera: " + String(err));
        });
    });

    return () => {
      cancelled = true;
      scannerRef.current?.stop?.().catch(() => {});
    };
  }, []);

  const banner = (() => {
    if (busy) return { bg: "#3f3f46", text: "Verifica in corso..." };
    if (!lastResult) return { bg: "#27272a", text: "Inquadra un QR code" };
    if (lastResult.result === "ok")
      return { bg: "#16a34a", text: `✅ Ingresso valido — ${lastResult.full_name ?? lastResult.email ?? ""} (${lastResult.event_name ?? ""})` };
    if (lastResult.result === "already_scanned")
      return { bg: "#dc2626", text: `⛔ Già scansionato — ${lastResult.full_name ?? lastResult.email ?? ""}` };
    if (lastResult.result === "void")
      return { bg: "#dc2626", text: "⛔ QR annullato" };
    return { bg: "#dc2626", text: "⛔ QR non riconosciuto" };
  })();

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px" }}>
      <h1 style={{ textAlign: "center", fontSize: 20 }}>Scansione ingressi</h1>
      <div
        id="qr-reader"
        ref={containerRef}
        style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}
      />
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          background: banner.bg,
          textAlign: "center",
          fontWeight: 600,
          minHeight: 24,
        }}
      >
        {banner.text}
      </div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </main>
  );
}
