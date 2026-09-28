import { Resend } from "resend";

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY mancante");
  return new Resend(key);
}

export async function sendConfirmationEmail(opts: {
  to: string;
  fullName?: string | null;
  eventName: string;
  qrPngBuffer: Buffer;
}) {
  const { to, fullName, eventName, qrPngBuffer } = opts;
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM mancante");

  const greeting = fullName ? `Ciao ${fullName},` : "Ciao,";

  const html = `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
    <h2 style="margin-bottom: 4px;">Conferma partecipazione</h2>
    <p style="color:#555; margin-top:0;">${eventName}</p>
    <p>${greeting}</p>
    <p>la tua iscrizione è confermata. Mostra questo QR code all'ingresso, verrà scansionato una sola volta.</p>
    <div style="text-align:center; margin: 24px 0;">
      <img src="cid:qrcode" alt="QR code ingresso" width="240" height="240" style="border:1px solid #eee; border-radius:8px;" />
    </div>
    <p style="font-size:13px; color:#888;">Conserva questa mail: il QR code è personale e utilizzabile una sola volta.</p>
  </div>`;

  const resend = resendClient();
  const result = await resend.emails.send({
    from,
    to,
    subject: `Conferma partecipazione — ${eventName}`,
    html,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrPngBuffer.toString("base64"),
        contentId: "qrcode",
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}
