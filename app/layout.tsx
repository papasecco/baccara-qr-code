import type { ReactNode } from "react";

export const metadata = {
  title: "Check-in QR",
  description: "Sistema di conferme partecipazione e check-in QR",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif",
          background: "#0b0c10",
          color: "#f4f4f5",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
