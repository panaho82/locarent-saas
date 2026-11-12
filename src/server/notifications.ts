import { appUrl, isConsoleTransport, mailTransport, sendMail } from "@/server/mail";
import { logActivity } from "@/server/audit";
import { formatDate } from "@/lib/format";

/**
 * Notification de l'agence après un check-in client.
 *
 * Le message est construit par une fonction **pure** (`buildCheckInNotification`)
 * pour être testable sans réseau ni base : le contenu d'un email qui prévient
 * d'un contrat signé n'est pas un détail.
 */

export type CheckInNotificationInput = {
  tenantName: string;
  agencyEmail: string;
  bookingNumber: string;
  bookingId: number;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  startDate: string;
  endDate: string;
  signerName: string;
  signedAt: Date;
  contractHash: string;
};

export type BuiltMail = { to: string; subject: string; text: string };

export function buildCheckInNotification(input: CheckInNotificationInput): BuiltMail {
  const subject = `Contrat signé — ${input.bookingNumber} (${input.customerName})`;

  const text = [
    `Bonjour ${input.tenantName},`,
    "",
    `${input.customerName} vient de terminer son check-in en ligne.`,
    "",
    `Réservation   : ${input.bookingNumber}`,
    `Véhicule      : ${input.vehicleName} (${input.licensePlate})`,
    `Période       : du ${input.startDate} au ${input.endDate}`,
    `Signataire    : ${input.signerName}`,
    `Signé le      : ${formatDate(input.signedAt)}`,
    "",
    `Empreinte du contrat : ${input.contractHash}`,
    "",
    "Le contrat signé, les photos du permis et de la pièce d'identité sont",
    "disponibles sur la fiche de la réservation :",
    appUrl(`/admin/reservations/${input.bookingId}`),
    "",
    "—",
    "Tahiti Keys",
  ].join("\n");

  return { to: input.agencyEmail, subject, text };
}

/**
 * Envoie la notification et journalise le résultat.
 *
 * Ne lève jamais : un email qui échoue ne doit pas annuler un check-in déjà
 * enregistré (contrat signé, photos stockées, empreinte calculée). L'échec est
 * tracé dans le journal d'audit pour être rejoué.
 */
export async function notifyCheckIn(
  tenantId: number,
  input: CheckInNotificationInput,
): Promise<{ sent: boolean; transport: string }> {
  const transport = mailTransport();
  const mail = buildCheckInNotification(input);

  try {
    await sendMail(mail);
    await logActivity({
      tenantId,
      userId: null,
      action: "booking.notified",
      subjectType: "booking",
      subjectId: input.bookingId,
      properties: {
        recipient: mail.to,
        subject: mail.subject,
        transport,
        // En transport « console », aucun email ne part : on le dit en clair.
        delivered: !isConsoleTransport(),
      },
    });
    return { sent: true, transport };
  } catch (error) {
    await logActivity({
      tenantId,
      userId: null,
      action: "booking.notification_failed",
      subjectType: "booking",
      subjectId: input.bookingId,
      properties: {
        recipient: mail.to,
        transport,
        error: error instanceof Error ? error.message.slice(0, 300) : "erreur inconnue",
      },
    });
    return { sent: false, transport };
  }
}
