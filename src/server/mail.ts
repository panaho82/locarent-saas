/**
 * Envoi d'emails.
 *
 * Deux transports :
 *   · `console` (défaut) — écrit le message dans les logs. Aucun email ne part.
 *   · `smtp`              — à brancher au Lot 3 (Mailpit en local, Resend/Brevo
 *                           en production).
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

export type MailTransport = "console" | "smtp";

export function mailTransport(): MailTransport {
  return process.env.MAIL_TRANSPORT === "smtp" ? "smtp" : "console";
}

/** Vrai tant qu'aucun email ne part réellement : les liens doivent être affichés. */
export function isConsoleTransport(): boolean {
  return mailTransport() === "console";
}

const FROM = process.env.MAIL_FROM ?? "Locarent <no-reply@locarent.test>";

export async function sendMail(message: MailMessage): Promise<void> {
  if (mailTransport() === "smtp") {
    if (!process.env.SMTP_HOST) {
      throw new Error(
        "MAIL_TRANSPORT=smtp mais SMTP_HOST est absent : impossible d'envoyer un email.",
      );
    }
    // Implémentation SMTP prévue au Lot 3.
    throw new Error(
      "Transport SMTP non encore implémenté (prévu au Lot 3). Utiliser MAIL_TRANSPORT=console.",
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
