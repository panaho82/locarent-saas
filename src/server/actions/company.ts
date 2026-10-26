"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { prisma } from "@/server/db";
import { companySettingsSchema } from "@/lib/validation/team";
import type { ActionState } from "./types";

/** Réglages « Entreprise » : identité de l'agence et couleur principale. */
export async function updateCompanyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  if (!can(session, "settings.edit")) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas de modifier les réglages.",
    };
  }

  const parsed = companySettingsSchema.safeParse({
    name: formData.get("name"),
    managerName: formData.get("managerName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    tahitiNumber: formData.get("tahitiNumber"),
    address: formData.get("address"),
    city: formData.get("city"),
    zipcode: formData.get("zipcode"),
    island: formData.get("island"),
    companyTagline: formData.get("companyTagline"),
    primaryColor: formData.get("primaryColor"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", fieldErrors };
  }

  const data = parsed.data;

  // `null` plutôt que chaîne vide : la base reste propre.
  const orNull = (value: string | undefined) => (value && value.length ? value : null);

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        name: data.name,
        managerName: orNull(data.managerName),
        email: data.email,
        phone: orNull(data.phone),
        tahitiNumber: orNull(data.tahitiNumber),
        address: orNull(data.address),
        city: orNull(data.city),
        zipcode: orNull(data.zipcode),
        island: orNull(data.island),
      },
    }),
    prisma.settings.upsert({
      where: { tenantId: session.tenantId },
      update: {
        companyTagline: orNull(data.companyTagline),
        primaryColor: data.primaryColor,
        ...(data.companyTagline ? { onboardingCompleted: true } : {}),
      },
      create: {
        tenantId: session.tenantId,
        companyTagline: orNull(data.companyTagline),
        primaryColor: data.primaryColor,
      },
    }),
  ]);

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "settings.company.updated",
    subjectType: "tenant",
    subjectId: session.tenantId,
    properties: { name: data.name },
  });

  revalidatePath("/admin/settings/company");
  revalidatePath("/admin/index");

  return { status: "success", message: "Réglages enregistrés." };
}
