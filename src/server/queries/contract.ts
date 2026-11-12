import type { ContractData } from "@/lib/contract";
import { prisma } from "@/server/db";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

/**
 * Assemblage des données du contrat.
 *
 * Deux points d'entrée : back-office (session + contexte d'agence) et page
 * publique de check-in (token, donc pas de session). Dans les deux cas, le
 * contrat n'expose que le prix **appliqué**.
 */

type BookingWithRelations = {
  bookingNumber: string;
  status: string;
  startDate: Date;
  startTime: string;
  endDate: Date;
  endTime: string;
  rentalDays: number;
  durationUnit: "days" | "weeks" | "months";
  durationValue: number;
  isUnlimitedKilometers: boolean;
  baseKilometers: number | null;
  extraKmPrice: number | null;
  vehicleTotal: number;
  extrasTotal: number;
  pickupLocationFee: number;
  dropoffLocationFee: number;
  totalPrice: number;
  taxRate: unknown;
  taxAmount: number;
  totalWithTax: number;
  cautionAmount: number | null;
  notes: string | null;
  extras: { name: string; total: number }[];
  discountsList: { label: string | null; amount: number }[];
  pickupLocation: { name: string } | null;
  dropoffLocation: { name: string } | null;
  customer: {
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    city: string | null;
    zipcode: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    phoneCode: string | null;
  };
  vehicle: {
    name: string;
    make: string | null;
    model: string | null;
    licensePlate: string;
    colorSlug: string | null;
    mileage: number;
  };
  contracts: {
    pdfPath: string;
    pdfHash: string | null;
    signedAt: Date | null;
    signerName: string | null;
    signerIp: string | null;
    signerUserAgent: string | null;
    signatureImagePath: string | null;
  }[];
};

function build(
  tenant: ContractData["agency"],
  conditionsHtml: string | null,
  booking: BookingWithRelations,
): ContractData {
  const contract = booking.contracts[0] ?? null;

  return {
    agency: tenant,
    customer: booking.customer,
    driver: null,
    vehicle: {
      name: booking.vehicle.name,
      make: booking.vehicle.make,
      model: booking.vehicle.model,
      licensePlate: booking.vehicle.licensePlate,
      color: booking.vehicle.colorSlug,
      mileage: booking.vehicle.mileage,
    },
    booking: {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      startDate: booking.startDate.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endDate: booking.endDate.toISOString().slice(0, 10),
      endTime: booking.endTime,
      rentalDays: booking.rentalDays,
      durationUnit: booking.durationUnit,
      durationValue: booking.durationValue,
      isUnlimitedKilometers: booking.isUnlimitedKilometers,
      baseKilometers: booking.baseKilometers,
      extraKmPrice: booking.extraKmPrice,
      vehicleTotal: booking.vehicleTotal,
      extrasTotal: booking.extrasTotal,
      pickupLocationFee: booking.pickupLocationFee,
      dropoffLocationFee: booking.dropoffLocationFee,
      totalPrice: booking.totalPrice,
      taxRate: Number(booking.taxRate),
      taxAmount: booking.taxAmount,
      totalWithTax: booking.totalWithTax,
      cautionAmount: booking.cautionAmount,
      notes: booking.notes,
      pickupLocationName: booking.pickupLocation?.name ?? null,
      dropoffLocationName: booking.dropoffLocation?.name ?? null,
      extras: booking.extras,
      discounts: booking.discountsList,
    },
    conditionsHtml,
    signature: contract
      ? {
          imageUrl: contract.signatureImagePath
            ? `/api/files/${contract.signatureImagePath}`
            : null,
          name: contract.signerName,
          signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
          ip: contract.signerIp,
          userAgent: contract.signerUserAgent,
          pdfHash: contract.pdfHash,
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}

const BOOKING_SELECT = {
  bookingNumber: true,
  status: true,
  startDate: true,
  startTime: true,
  endDate: true,
  endTime: true,
  rentalDays: true,
  durationUnit: true,
  durationValue: true,
  isUnlimitedKilometers: true,
  baseKilometers: true,
  extraKmPrice: true,
  vehicleTotal: true,
  extrasTotal: true,
  pickupLocationFee: true,
  dropoffLocationFee: true,
  totalPrice: true,
  taxRate: true,
  taxAmount: true,
  totalWithTax: true,
  cautionAmount: true,
  notes: true,
  extras: { select: { name: true, total: true } },
  discountsList: { select: { label: true, amount: true } },
  pickupLocation: { select: { name: true } },
  dropoffLocation: { select: { name: true } },
  customer: {
    select: {
      firstName: true,
      lastName: true,
      address: true,
      city: true,
      zipcode: true,
      country: true,
      email: true,
      phone: true,
      phoneCode: true,
    },
  },
  vehicle: {
    select: {
      name: true,
      make: true,
      model: true,
      licensePlate: true,
      colorSlug: true,
      mileage: true,
    },
  },
  contracts: {
    orderBy: { version: "desc" as const },
    take: 1,
    select: {
      pdfPath: true,
      pdfHash: true,
      signedAt: true,
      signerName: true,
      signerIp: true,
      signerUserAgent: true,
      signatureImagePath: true,
    },
  },
} as const;

export async function loadContractForBooking(
  tenantId: number,
  bookingId: number,
): Promise<ContractData | null> {
  return withTenant(tenantId, async () => {
    const [tenant, settings, booking] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId } }),
      db.settings.findFirst({ select: { contractConditions: true } }),
      db.booking.findFirst({ where: { id: bookingId }, select: BOOKING_SELECT }),
    ]);

    if (!tenant || !booking) return null;

    return build(
      {
        name: tenant.name,
        managerName: tenant.managerName,
        address: tenant.address,
        city: tenant.city,
        zipcode: tenant.zipcode,
        phone: tenant.phone,
        email: tenant.email,
        tahitiNumber: tenant.tahitiNumber,
      },
      settings?.contractConditions ?? null,
      booking as unknown as BookingWithRelations,
    );
  });
}

/** Variante publique : le token identifie la réservation, sans session. */
export async function loadContractByCheckInToken(
  token: string,
): Promise<ContractData | null> {
  const booking = await prisma.booking.findUnique({
    where: { checkInToken: token },
    select: { id: true, tenantId: true },
  });
  if (!booking) return null;
  return loadContractForBooking(booking.tenantId, booking.id);
}
