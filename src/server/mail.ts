/**
 * Envoi d'emails.
 *
 * Trois transports :
 *   · `console` (défaut) — écrit le message dans les logs. Aucun email ne part.
 *   · `resend`            — API HTTP de Resend (production).
 *   · `smtp`              — non implémenté : échoue explicitement plutôt que de
 *                           perdre un message en silence.
 *
 * Le choix ne dépend **pas** de NODE_ENV : un build de production sans SMTP
 * configuré doit rester utilisable (et le dire), plutôt que de perdre
 * silencieusement les messages.
 *
 * Ne jamais journaliser un token complet en production.
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type MailTransport = "console" | "resend" | "smtp";

export function mailTransport(): MailTransport {
  if (process.env.MAIL_TRANSPORT === "resend") return "resend";
  if (process.env.MAIL_TRANSPORT === "smtp") return "smtp";
  return "console";
}

/** Vrai tant qu'aucun email ne part réellement : les liens doivent être affichés. */
export function isConsoleTransport(): boolean {
  return mailTransport() === "console";
}

const FROM = process.env.MAIL_FROM ?? "Locarent <no-reply@locarent.test>";

export async function sendMail(message: MailMessage): Promise<void> {
  if (mailTransport() === "resend") {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "MAIL_TRANSPORT=resend mais RESEND_API_KEY est absent : impossible d'envoyer un email.",
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend a refusé l'envoi (${response.status}) : ${detail.slice(0, 300)}`);
    }
    return;
  }

  if (mailTransport() === "smtp") {
    if (!process.env.SMTP_HOST) {
      throw new Error(
        "MAIL_TRANSPORT=smtp mais SMTP_HOST est absent : impossible d'envoyer un email.",
      );
    }
    throw new Error(
      "Transport SMTP non implémenté. Utiliser MAIL_TRANSPORT=resend (production) ou console.",
    );
  }

  const lines = [
    "",
    "┌── email (transport « console », aucun envoi réel) ────────",
    `│ De      : ${FROM}`,
    `│ À       : ${message.to}`,
    `│ Objet   : ${message.subject}`,
    "├───────────────────────────────────────────────────────────",
    ...message.text.split("\n").map((line) => `│ ${line}`),
    "└───────────────────────────────────────────────────────────",
    "",
  ];
  console.log(lines.join("\n"));
}

/** URL absolue de l'application, pour les liens envoyés par email. */
export function appUrl(path = "/"): string {
  const base = process.env.APP_URL ?? "http://localhost:3210";
  return new URL(path, base).toString();
}
