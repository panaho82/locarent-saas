import { headers } from "next/headers";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

/**
 * Journal d'audit.
 *
 * Absent chez l'éditeur d'origine, indispensable ici : un contrat signé, une
 * caution restituée ou une désactivation de compte doivent être traçables.
 *
 * Utilise le client brut : on journalise parfois hors contexte d'agence
 * (connexion, échec d'invitation).
 */

export type ActivityInput = {
  tenantId: number;
  userId?: number | null;
  /** ex. booking.confirmed, invoice.sent, user.deactivated */
  action: string;
  subjectType?: string | null;
  subjectId?: number | null;
  properties?: Prisma.InputJsonValue;
};

async function clientIp(): Promise<string | null> {
  try {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim().slice(0, 45) ?? null;
  } catch {
    // hors contexte de requête (script, tâche de fond)
    return null;
  }
}

/** Écrit une ligne d'audit. N'échoue jamais la requête métier. */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: input.action,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        properties: input.properties ?? {},
        ip: await clientIp(),
      },
    });
  } catch (error) {
    console.error("logActivity", error);
  }
}
