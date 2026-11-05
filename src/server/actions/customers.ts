"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { requireTenantId, withTenant } from "@/server/tenant-context";
import {
  companySchema,
  customerSchema,
  driverSchema,
  fieldErrors,
} from "@/lib/validation/customer";
import type { ActionState } from "./types";

/**
 * Clients, sociétés et conducteurs.
 *
 * Les lectures et écritures passent par le client tenant-scoped ; les mises à
 * jour utilisent `updateMany` pour que le filtre d'agence soit toujours actif.
 */

const date = (value: string | null) =>
  value === null ? null : new Date(`${value}T00:00:00Z`);

// --- Clients (particuliers) --------------------------------------------------

export async function createCustomerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "customer.create")) {
    return { status: "error", message: "Votre rôle ne permet pas d'ajouter un client." };
  }

  const parsed = customerSchema.safeParse({
    type: "private",
    isInsurance: formData.get("isInsurance"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    phoneCode: formData.get("phoneCode") ?? "+689",
    address: formData.get("address"),
    zipcode: formData.get("zipcode"),
    city: formData.get("city"),
    country: formData.get("country"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const customer = await withTenant(session.tenantId, () =>
    db.customer.create({
      data: {
        tenantId: requireTenantId(),
        type: "private",
        source: "admin",
        isInsurance: d.isInsurance,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        phoneCode: d.phoneCode ?? "+689",
        address: d.address,
        zipcode: d.zipcode,
        city: d.city,
        country: d.country ?? "Polynésie française",
        notes: d.notes,
      },
      select: { id: true },
    }),
  );

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "customer.created",
    subjectType: "customer",
    subjectId: customer.id,
    properties: { name: `${d.firstName} ${d.lastName}` },
  });

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${customer.id}`);
}

export async function updateCustomerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "customer.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier un client." };
  }

  const id = Number(formData.get("customerId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "Client introuvable." };

  const parsed = customerSchema.safeParse({
    type: "private",
    isInsurance: formData.get("isInsurance"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    phoneCode: formData.get("phoneCode"),
    address: formData.get("address"),
    zipcode: formData.get("zipcode"),
    city: formData.get("city"),
    country: formData.get("country"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const updated = await withTenant(session.tenantId, async () => {
    const result = await db.customer.updateMany({
      where: { id },
      data: {
        isInsurance: d.isInsurance,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        phoneCode: d.phoneCode,
        address: d.address,
        zipcode: d.zipcode,
        city: d.city,
        country: d.country,
        notes: d.notes,
      },
    });
    return result.count;
  });

  if (updated === 0) return { status: "error", message: "Client introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "customer.updated",
    subjectType: "customer",
    subjectId: id,
  });

  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
  return { status: "success", message: "Client mis à jour." };
}

// --- Conducteurs -------------------------------------------------------------

export async function addDriverAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "driver.create")) {
    return { status: "error", message: "Votre rôle ne permet pas d'ajouter un conducteur." };
  }

  const parsed = driverSchema.safeParse({
    customerId: formData.get("customerId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    licenseCardNumber: formData.get("licenseCardNumber"),
    licenseIssuedAt: formData.get("licenseIssuedAt"),
    licenseExpiresAt: formData.get("licenseExpiresAt"),
    licenseCountry: formData.get("licenseCountry"),
    isMain: formData.get("isMain"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const customerId = Number(d.customerId);

  const created = await withTenant(session.tenantId, async () => {
    // Le client doit appartenir à l'agence (le filtre porte le tenant).
    const customer = await db.customer.findFirst({ where: { id: customerId }, select: { id: true } });
    if (!customer) return false;

    if (d.isMain) {
      await db.driver.updateMany({ where: { customerId }, data: { isMain: false } });
    }

    await db.driver.create({
      data: {
        tenantId: requireTenantId(),
        customerId,
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: date(d.dateOfBirth),
        licenseCardNumber: d.licenseCardNumber,
        licenseIssuedAt: date(d.licenseIssuedAt),
        licenseExpiresAt: date(d.licenseExpiresAt),
        licenseCountry: d.licenseCountry ?? "Polynésie française",
        isMain: d.isMain,
      },
    });
    return true;
  });

  if (!created) return { status: "error", message: "Client introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "driver.created",
    subjectType: "customer",
    subjectId: customerId,
    properties: { name: `${d.firstName} ${d.lastName}` },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  return { status: "success", message: "Conducteur ajouté." };
}

export async function removeDriverAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session, "driver.edit")) return;

  const id = Number(formData.get("driverId"));
  const customerId = Number(formData.get("customerId"));
  if (!Number.isInteger(id) || !Number.isInteger(customerId)) return;

  await withTenant(session.tenantId, async () => {
    // Un conducteur rattaché à une réservation ne doit pas disparaître.
    const used = await db.bookingDriver.count({ where: { driverId: id } });
    if (used > 0) return;
    await db.driver.deleteMany({ where: { id, customerId } });
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "driver.deleted",
    subjectType: "customer",
    subjectId: customerId,
    properties: { driverId: id },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

// --- Sociétés ----------------------------------------------------------------

export async function createCompanyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "customer.create")) {
    return { status: "error", message: "Votre rôle ne permet pas d'ajouter une entreprise." };
  }

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    zipcode: formData.get("zipcode"),
    city: formData.get("city"),
    country: formData.get("country"),
    taxId: formData.get("taxId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const company = await withTenant(session.tenantId, () =>
    db.company.create({
      data: {
        tenantId: requireTenantId(),
        name: d.name,
        contactName: d.contactName,
        email: d.email,
        phone: d.phone,
        address: d.address,
        zipcode: d.zipcode,
        city: d.city,
        country: d.country ?? "Polynésie française",
        taxId: d.taxId,
        notes: d.notes,
      },
      select: { id: true },
    }),
  );

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "company.created",
    subjectType: "company",
    subjectId: company.id,
    properties: { name: d.name },
  });

  revalidatePath("/admin/customers");
  redirect(`/admin/companies/${company.id}`);
}

export async function updateCompanyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "customer.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier une entreprise." };
  }

  const id = Number(formData.get("companyId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "Entreprise introuvable." };

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    zipcode: formData.get("zipcode"),
    city: formData.get("city"),
    country: formData.get("country"),
    taxId: formData.get("taxId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const updated = await withTenant(session.tenantId, async () => {
    const result = await db.company.updateMany({
      where: { id },
      data: {
        name: d.name,
        contactName: d.contactName,
        email: d.email,
        phone: d.phone,
        address: d.address,
        zipcode: d.zipcode,
        city: d.city,
        country: d.country,
        taxId: d.taxId,
        notes: d.notes,
      },
    });
    return result.count;
  });

  if (updated === 0) return { status: "error", message: "Entreprise introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "company.updated",
    subjectType: "company",
    subjectId: id,
  });

  revalidatePath(`/admin/companies/${id}`);
  revalidatePath("/admin/customers");
  return { status: "success", message: "Entreprise mise à jour." };
}
