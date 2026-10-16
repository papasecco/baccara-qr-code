export function eventNameOf(reg: any): string | undefined {
  const rel = reg?.event;
  return Array.isArray(rel) ? rel[0]?.name : rel?.name;
}

// Solo per la lista LOCURA: la scelta del ticket ("10€" / "20€ - 2 drinks") è l'unica domanda a scelta del form.
export function ticketTypeOf(reg: any): string | null {
  if (eventNameOf(reg)?.trim().toUpperCase() !== "LOCURA") return null;
  const answers: any[] = Array.isArray(reg?.raw_answers) ? reg.raw_answers : [];
  const a = answers.find((x) => x?.type === "choice" || x?.type === "choices");
  const value = a?.choice?.label ?? a?.choice?.other ?? a?.choices?.labels?.join(", ") ?? null;
  return value ? String(value).trim() : null;
}

// Nome e cognome stanno nelle prime due risposte di testo (stessi ref in tutti i form), il cellulare nella risposta phone_number.
const FIRST_NAME_REF = "e3181c76-075e-40f7-aec4-cfc1934af3e3";
const LAST_NAME_REF = "74aba0f2-206c-47c6-9387-37339d4efea3";

export function personOf(reg: any): { fullName: string; phone: string | null } {
  const answers: any[] = Array.isArray(reg?.raw_answers) ? reg.raw_answers : [];
  const first = answers.find((a) => a?.field?.ref === FIRST_NAME_REF)?.text ?? reg?.full_name ?? "";
  const last = answers.find((a) => a?.field?.ref === LAST_NAME_REF)?.text ?? "";
  const phone = answers.find((a) => a?.type === "phone_number")?.phone_number ?? null;
  return { fullName: `${first} ${last}`.trim(), phone };
}
