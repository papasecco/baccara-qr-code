import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
      <h1>Check-in QR</h1>
      <p style={{ color: "#a1a1aa" }}>Sistema di conferme partecipazione e ingresso.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
        <Link
          href="/scan"
          style={{ background: "#22c55e", color: "#052e16", padding: "14px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}
        >
          Scansiona ingressi
        </Link>
        <Link
          href="/dashboard"
          style={{ background: "#27272a", color: "#f4f4f5", padding: "14px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}
        >
          Dashboard live
        </Link>
      </div>
    </main>
  );
}
