import QRCode from "qrcode";

// Genera un PNG (Buffer) del QR code che codifica semplicemente il token/id della registrazione.
// Il token è un uuid v4 (122 bit di entropia): indovinarlo non è fattibile,
// e comunque viene invalidato al primo scan, quindi non serve altro offuscamento.
export async function generateQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
}
