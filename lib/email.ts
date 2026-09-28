import { Resend } from "resend";

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY mancante");
  return new Resend(key);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendConfirmationEmail(opts: {
  to: string;
  fullName?: string | null;
  qrPngBuffer: Buffer;
}) {
  const { to, fullName, qrPngBuffer } = opts;
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM mancante");

  const name = fullName ? `${escapeHtml(fullName.trim())}, ` : "";

  const html = `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 16px; color: #111; text-align: center;">
    <h1 style="margin: 0 0 4px; font-size: 24px; letter-spacing: 1px;">FRIDAY OPENING PARTY</h1>
    <p style="margin: 0 0 24px; color: #555;">Venerdì 16 Ottobre 2026</p>
    <h2 style="margin: 0 0 16px; font-size: 20px;">${name}ISCRIZIONE CONFERMATA ✅</h2>
    <p style="margin: 0 0 4px; font-size: 18px; font-weight: 600;">Ridotto in lista 10€</p>
    <p style="margin: 0 0 24px; color: #555;">valido entro 1:00</p>
    <p style="margin: 0 0 16px;">Mostra questo QrCode all’ingresso del locale</p>
    <img src="cid:qrcode" alt="QR code ingresso" width="240" height="240" style="border:1px solid #eee; border-radius:8px;" />
  </div>`;

  const resend = resendClient();
  const result = await resend.emails.send({
    from,
    to,
    subject: "FRIDAY OPENING PARTY — Iscrizione confermata ✅",
    html,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrPngBuffer.toString("base64"),
        inlineContentId: "qrcode",
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}
