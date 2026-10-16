"use client";

import { useEffect, useRef, useState } from "react";

type CheckinResult = {
  result: "ok" | "already_scanned" | "not_found" | "void";
  full_name?: string;
  email?: string;
  event_name?: string;
  ticket_type?: string | null;
  scanned_at?: string;
};

type SearchHit = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  event_name?: string;
  ticket_type: string | null;
  status: string;
  scanned_at: string | null;
};

const isLocuraName = (name?: string | null) => name?.trim().toUpperCase() === "LOCURA";

function LocuraBadge({ ticketType, compact }: { ticketType?: string | null; compact?: boolean }) {
  const withDrinks = /drink/i.test(ticketType ?? "");
  return (
    <div
      style={{
        marginTop: 12,
        padding: compact ? 12 : 20,
        borderRadius: 12,
        textAlign: "center",
        background: withDrinks ? "#7e22ce" : "#ea580c",
        border: "4px solid #fff",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, opacity: 0.9 }}>LISTA</div>
      <div style={{ fontSize: compact ? 26 : 34, fontWeight: 800, letterSpacing: 2 }}>LOCURA</div>
      <div style={{ marginTop: 8, fontSize: compact ? 22 : 26, fontWeight: 800 }}>
        {withDrinks ? "🍹 2 DRINK INCLUSI" : "SENZA DRINK"}
      </div>
      {ticketType && <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600 }}>{ticketType}</div>}
    </div>
  );
}

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

export default function ScanPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const searchSeq = useRef(0);

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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      searchSeq.current++;
      setHits([]);
      setTruncated(false);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("errore " + res.status);
        const data = await res.json();
        if (seq !== searchSeq.current) return;
        setHits(data.results ?? []);
        setTruncated(!!data.truncated);
        setSearchError(null);
      } catch (e) {
        if (seq === searchSeq.current) setSearchError("Ricerca non riuscita, riprova");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function validate(hit: SearchHit) {
    setValidatingId(hit.id);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: hit.id }),
      });
      const data: CheckinResult = await res.json();
      setLastResult(data);
      if (data.result === "ok" || data.result === "already_scanned") {
        setHits((prev) =>
          prev.map((h) =>
            h.id === hit.id
              ? { ...h, status: "scanned", scanned_at: data.scanned_at ?? new Date().toISOString() }
              : h
          )
        );
      }
      setSearchError(null);
    } catch (e) {
      setSearchError("Errore di rete, riprova");
    } finally {
      setValidatingId(null);
    }
  }

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

  const showLocura =
    !busy &&
    (lastResult?.result === "ok" || lastResult?.result === "already_scanned") &&
    isLocuraName(lastResult?.event_name);

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
      {showLocura && <LocuraBadge ticketType={lastResult?.ticket_type} />}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <h2 style={{ fontSize: 17, marginTop: 32, marginBottom: 8 }}>Cerca manualmente</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nome e cognome, mail o cellulare"
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 14,
          borderRadius: 10,
          border: "1px solid #3f3f46",
          background: "#18181b",
          color: "#f4f4f5",
          fontSize: 16,
        }}
      />
      {query.trim().length > 0 && query.trim().length < 3 && (
        <p style={{ color: "#a1a1aa", fontSize: 13 }}>Scrivi almeno 3 caratteri</p>
      )}
      {searching && <p style={{ color: "#a1a1aa", fontSize: 13 }}>Ricerca in corso...</p>}
      {searchError && <p style={{ color: "#f87171" }}>{searchError}</p>}
      {!searching && query.trim().length >= 3 && !searchError && hits.length === 0 && (
        <p style={{ color: "#a1a1aa" }}>Nessun risultato</p>
      )}

      {hits.map((hit) => {
        const entered = hit.status === "scanned";
        return (
          <div
            key={hit.id}
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              background: "#18181b",
              border: `1px solid ${entered ? "#7f1d1d" : "#27272a"}`,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>{hit.full_name || "(senza nome)"}</div>
            <div style={{ color: "#a1a1aa", fontSize: 14, wordBreak: "break-all" }}>{hit.email}</div>
            {hit.phone && <div style={{ color: "#a1a1aa", fontSize: 14 }}>{hit.phone}</div>}
            <div style={{ marginTop: 4, fontSize: 14 }}>Lista: {hit.event_name ?? "-"}</div>
            {isLocuraName(hit.event_name) && <LocuraBadge ticketType={hit.ticket_type} compact />}
            {entered ? (
              <div style={{ marginTop: 10, color: "#f87171", fontWeight: 700 }}>
                ⛔ Già entrato{hit.scanned_at ? ` alle ${timeOf(hit.scanned_at)}` : ""}
              </div>
            ) : (
              <button
                onClick={() => validate(hit)}
                disabled={validatingId === hit.id}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: 14,
                  borderRadius: 10,
                  border: "none",
                  background: "#22c55e",
                  color: "#052e16",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {validatingId === hit.id ? "..." : "Valida ingresso"}
              </button>
            )}
          </div>
        );
      })}
      {truncated && (
        <p style={{ color: "#a1a1aa", fontSize: 13 }}>Mostro i primi 20 risultati: affina la ricerca.</p>
      )}
    </main>
  );
}
