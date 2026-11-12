import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { renderContractHtml } from "@/lib/contract";
import { loadContractForBooking } from "@/server/queries/contract";
import { prisma } from "@/server/db";
import { decodeDataUrl, saveFile, saveText } from "@/server/storage";
import { logActivity } from "@/server/audit";
import { notifyCheckIn } from "@/server/notifications";
import { formatDateOnly } from "@/lib/format";

/**
 * Check-in en ligne.
 *
 * Le client reçoit un lien `/check-in/{token}`, photographie son permis et sa
 * pièce d'identité, lit le contrat et le signe au doigt. On conserve :
 *  · les photos (stockage objet, chemin non devinable) ;
 *  · la signature (PNG) ;
 *  · le contrat **figé** au moment de la signature, avec son empreinte
 *    SHA-256, l'IP et le user-agent — c'est la preuve en cas de litige.
 *
 * Cette fonction s'exécute hors session : le token est la seule autorisation.
 */

const MAX_BYTES = 8 * 1024 * 1024;

type PhotoField = {
  field: string;
  type: "license_front" | "license_back" | "id_front" | "id_back";
  label: string;
};

const PHOTOS: PhotoField[] = [
  { field: "licenseFront", type: "license_front", label: "Permis (recto)" },
  { field: "licenseBack", type: "license_back", label: "Permis (verso)" },
  { field: "idFront", type: "id_front", label: "Pièce d'identité (recto)" },
  { field: "idBack", type: "id_back", label: "Pièce d'identité (verso)" },
];

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export type CheckInResult = { ok: true } | { ok: false; error: string };

export async function performCheckIn(
  token: string,
  formData: FormData,
): Promise<CheckInResult> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "Lien invalide." };

  const booking = await prisma.booking.findUnique({
    where: { checkInToken: token },
    include: {
      customer: true,
      vehicle: { select: { name: true, licensePlate: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });

  if (!booking) return { ok: false, error: "Réservation introuvable." };
  if (booking.checkInCompletedAt) {
    return { ok: false, error: "Ce check-in a déjà été effectué." };
  }

  const signerName = String(formData.get("signerName") ?? "").trim();
  const consent = formData.get("consent") === "on";
  const signatureData = String(formData.get("signature") ?? "");

  if (signerName.length < 2) {
    return { ok: false, error: "Indiquez le nom du signataire." };
  }
  if (!consent) {
    return { ok: false, error: "Le consentement est obligatoire." };
  }
  if (!signatureData.startsWith("data:image/")) {
    return { ok: false, error: "La signature est manquante." };
  }

  // --- Photos ---------------------------------------------------------------
  const uploads: { type: PhotoField["type"]; path: string; mime: string; size: number }[] = [];

  for (const photo of PHOTOS) {
    const file = formData.get(photo.field);
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: `Photo manquante : ${photo.label}.` };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: `Format non accepté pour ${photo.label}.` };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: `Photo trop lourde : ${photo.label} (8 Mo maximum).` };
    }

    const stored = await saveFile(Buffer.from(await file.arrayBuffer()), {
      folder: "check-in",
      extension: extensionFor(file),
    });

    uploads.push({ type: photo.type, path: stored.path, mime: file.type, size: stored.bytes });
  }

  // --- Signature ------------------------------------------------------------
  let signature;
  try {
    signature = decodeDataUrl(signatureData);
  } catch {
    return { ok: false, error: "Signature illisible." };
  }

  const signatureFile = await saveFile(signature.buffer, {
    folder: "signatures",
    extension: signature.extension,
  });

  // --- Contrat figé ---------------------------------------------------------
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim().slice(0, 45) ?? null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;
  const signedAt = new Date();

  const contractData = await loadContractForBooking(booking.tenantId, booking.id);
  if (!contractData) return { ok: false, error: "Contrat indisponible." };

  // Le contrat est rendu **avec** la signature : l'empreinte couvre donc le
  // document signé, et plus seulement ses données.
  contractData.signature = {
    imageUrl: signatureFile.url,
    name: signerName,
    signedAt: signedAt.toISOString(),
    ip,
    userAgent,
    pdfHash: null,
  };
  contractData.generatedAt = signedAt.toISOString();

  // L'empreinte porte sur le contrat **sans sa propre ligne d'empreinte** :
  // sinon le document devrait se contenir lui-même. La vérification consiste à
  // retirer cette ligne du fichier archivé, puis à recalculer le SHA-256.
  const withoutHash = renderContractHtml(contractData);
  const pdfHash = createHash("sha256").update(withoutHash).digest("hex");

  contractData.signature.pdfHash = pdfHash;
  const signedHtml = renderContractHtml(contractData);
  const snapshot = await saveText(signedHtml, { folder: "contracts", extension: "html" });

  await prisma.$transaction(async (tx) => {
    for (const upload of uploads) {
      await tx.document.create({
        data: {
          tenantId: booking.tenantId,
          customerId: booking.customerId,
          bookingId: booking.id,
          type: upload.type,
          path: upload.path,
          mime: upload.mime,
          sizeBytes: upload.size,
        },
      });
    }

    await tx.contract.create({
      data: {
        bookingId: booking.id,
        version: 1,
        pdfPath: snapshot.path,
        pdfHash,
        signedAt,
        signerName,
        signerIp: ip,
        signerUserAgent: userAgent,
        signatureImagePath: signatureFile.path,
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        checkInCompletedAt: signedAt,
        hasSignedContract: true,
        contractSignedAt: signedAt,
        contractSignatureIp: ip,
        contractSignatureName: signerName,
        contractSignatureUa: userAgent,
        contractSignatureUrl: signatureFile.path,
      },
    });
  });

  await logActivity({
    tenantId: booking.tenantId,
    userId: null,
    action: "booking.checked_in",
    subjectType: "booking",
    subjectId: booking.id,
    properties: { signerName, contractHash: pdfHash, snapshot: snapshot.path },
  });

  // Prévenir l'agence. Un échec d'envoi ne remet pas en cause le check-in :
  // le contrat est signé et archivé, seule la notification est à rejouer.
  await notifyCheckIn(booking.tenantId, {
    tenantName: booking.tenant.name,
    agencyEmail: booking.tenant.email,
    bookingNumber: booking.bookingNumber,
    bookingId: booking.id,
    customerName: [booking.customer.firstName, booking.customer.lastName]
      .filter(Boolean)
      .join(" "),
    vehicleName: booking.vehicle.name,
    licensePlate: booking.vehicle.licensePlate,
    startDate: formatDateOnly(booking.startDate),
    endDate: formatDateOnly(booking.endDate),
    signerName,
    signedAt,
    contractHash: pdfHash,
  });

  return { ok: true };
}
