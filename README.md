# Check-in QR — conferme partecipazione via Typeform

Sistema per: ricevere iscrizioni da più Typeform (uno per PR), mandare in automatico
una mail con QR code univoco, scansionarlo all'ingresso (una sola volta) e vedere
in tempo reale quanti ingressi ci sono stati, per PR.

## Come funziona

1. Il cliente compila un Typeform → Typeform manda un webhook a questa app.
2. L'app salva l'iscrizione nel database, genera un QR code univoco e manda la mail di conferma (Resend).
3. Il tuo staff apre `/scan` da telefono, inquadra il QR all'ingresso: se è valido lo marca come "usato" e non potrà essere riusato; se è già stato scansionato lo segnala in rosso.
4. Tu apri `/dashboard` e vedi in tempo reale iscritti/entrati per ogni PR.

Sia `/scan` che `/dashboard` sono protette da una password dello staff (nessun QR o dato sensibile è pubblico).

---

## 1. Crea il progetto Supabase (database)

1. Vai su [supabase.com](https://supabase.com) → crea un account/progetto gratuito (scegli una regione vicina, es. Frankfurt).
2. Nel progetto, apri **SQL Editor** → incolla ed esegui il contenuto di [`supabase/schema.sql`](supabase/schema.sql). Crea le tabelle `events`, `registrations` e la vista `event_stats`.
3. Vai su **Project Settings → API**: ti servono due valori per dopo:
   - `Project URL` → sarà `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (sotto "Project API keys", NON la `anon` key) → sarà `SUPABASE_SERVICE_ROLE_KEY`. **Non condividerla mai pubblicamente**, dà accesso completo al database.

## 2. Configura Resend (invio mail)

1. Crea un account su [resend.com](https://resend.com).
2. **Domains** → aggiungi il tuo dominio (es. `tuolocale.it`) e imposta i record DNS che ti indica (serve per non finire in spam). Se non hai un dominio, puoi usare temporaneamente l'indirizzo di test di Resend, ma le mail arriveranno solo alla tua casella verificata finché non verifichi un dominio vero.
3. **API Keys** → crea una chiave → sarà `RESEND_API_KEY`.
4. Decidi l'indirizzo mittente, es. `"Nome Locale <eventi@tuolocale.it>"` → sarà `EMAIL_FROM`.

## 3. Prepara le variabili d'ambiente

Copia `.env.example` in `.env.local` e compila tutti i valori (vedi sopra per Supabase/Resend). Per `TYPEFORM_WEBHOOK_SECRET`, `STAFF_PASSWORD` e `SESSION_SECRET` genera stringhe casuali robuste, ad esempio con:

```bash
openssl rand -hex 24
```

`STAFF_PASSWORD` è la password che il tuo staff userà per accedere a `/scan` e `/dashboard` la sera dell'evento — sceglila semplice da digitare ma non banale.

## 4. Deploy su Vercel

1. Metti questo progetto su un repository GitHub (privato va bene).
2. Vai su [vercel.com](https://vercel.com) → **Add New Project** → importa il repository.
3. In **Environment Variables** incolla tutte le variabili di `.env.local` (tranne che qui non serve `.env.local` stesso, solo i valori).
4. Deploy. Una volta online avrai un URL tipo `https://tuo-progetto.vercel.app`.
5. Torna nelle Environment Variables su Vercel e imposta anche `NEXT_PUBLIC_APP_URL` con quell'URL, poi rideploya.

## 5. Crea un evento per ogni PR/Typeform

Per ogni Typeform che userai (uno a PR), aggiungi una riga nella tabella `events` di Supabase:

- Vai su Supabase → **Table Editor → events → Insert row**
- `name`: es. "Serata — Marco" (comparirà nella dashboard)
- `typeform_form_id`: l'ID del form Typeform. Lo trovi nell'URL dell'editor Typeform: `admin.typeform.com/form/XXXXXXXX/...` → `XXXXXXXX` è il form_id.
- `is_active`: lascialo su `true`

Ripeti per ogni PR/Typeform.

## 6. Configura ogni Typeform

Per **ogni** typeform che userai:

1. **Importante — imposta i "ref" dei campi**: nell'editor Typeform, apri le impostazioni del campo email e del campo nome, e nella sezione avanzata imposta il **Field ID/ref** a `email` (per il campo email) e `name` (per il campo nome/cognome). Questo permette all'app di riconoscere sempre gli stessi campi anche se il testo delle domande cambia da form a form.
   - Deve esserci per forza un campo di tipo **Email**.
2. Vai su **Connect → Webhooks** (nel typeform) → **Add a webhook**:
   - URL: `https://tuo-progetto.vercel.app/api/webhook/typeform`
   - Secret: lo stesso valore che hai messo in `TYPEFORM_WEBHOOK_SECRET`
   - Attiva il webhook.
3. Fai un invio di prova del typeform con una tua mail e controlla che ti arrivi la mail col QR code.

## 7. La sera dell'evento

- Il tuo staff apre `https://tuo-progetto.vercel.app/scan` da telefono, inserisce la password staff, concede il permesso fotocamera, e inquadra i QR in arrivo. Funziona da qualunque telefono con un browser (non serve installare app).
- Tu (o chi gestisce l'ingresso) apri `https://tuo-progetto.vercel.app/dashboard` per vedere i numeri in tempo reale, aggiornati ogni 3 secondi.

## Sicurezza / cose da sapere

- Ogni QR code contiene solo un identificativo casuale (uuid) non indovinabile: da solo non rivela nomi o mail.
- Un QR può essere usato **una sola volta**: al primo scan valido viene marcato "scanned" e ogni scan successivo dello stesso QR viene rifiutato e segnalato in rosso con il nome della persona.
- `/scan` e `/dashboard` richiedono la password staff; senza login non sono accessibili.
- Il webhook da Typeform è verificato con firma HMAC (il `TYPEFORM_WEBHOOK_SECRET`): richieste non firmate correttamente vengono rifiutate.
- La `service_role` key di Supabase resta solo lato server (variabili d'ambiente Vercel), mai esposta al browser.

## Sviluppo locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`. Per testare i webhook Typeform in locale serve un tunnel pubblico (es. `ngrok http 3000`) da usare come URL del webhook.
