import type { Metadata } from "next";
import { CheckInForm } from "@/components/checkin/check-in-form";
import { formatDateTime, formatDateOnly, formatXPF } from "@/lib/format";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Check-in en ligne",
  robots: { index: false, follow: false },
};

/**
 * Page publique de check-in.
 *
 * Le token (UUID v4) est la seule autorisation : il n'est envoyé qu'au client
 * concerné. Aucune donnée d'une autre réservation n'est atteignable, et la page
 * est exclue de l'indexation.
 */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return <InvalidLink />;
  }

  const booking = await prisma.booking.findUnique({
    where: { checkInToken: token },
    include: {
      tenant: { select: { name: true, logoPath: true, email: true } },
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { name: true, licensePlate: true } },
      pickupLocation: { select: { name: true } },
      contracts: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!booking) return <InvalidLink />;

  const customerName = [booking.customer.firstName, booking.customer.lastName]
    .filter(Boolean)
    .join(" ");
  const done = Boolean(booking.checkInCompletedAt);

  return (
    <main className="min-h-dvh bg-app pb-16">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">{booking.tenant.name}</p>
            <h1 className="text-lg font-bold text-ink">Check-in en ligne</h1>
          </div>
          <p className="text-right text-[12px] text-muted">
            Réservation
            <br />
            <span className="font-semibold text-ink">{booking.bookingNumber}</span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-5 rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Votre réservation</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Client", customerName || "—"],
              ["Véhicule", `${booking.vehicle.name} · ${booking.vehicle.licensePlate}`],
              [
                "Départ",
                `${formatDateOnly(booking.startDate)} à ${booking.startTime}${
                  booking.pickupLocation ? ` · ${booking.pickupLocation.name}` : ""
                }`,
              ],
              ["Retour", `${formatDateOnly(booking.endDate)} à ${booking.endTime}`],
              ["Montant", formatXPF(booking.totalWithTax)],
              ["Durée", `${booking.durationValue} ${booking.durationUnit === "days" ? "jour(s)" : booking.durationUnit}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {done ? (
          <section className="rounded-card border border-success/40 bg-success/5 p-6 text-center">
            <p className="text-base font-semibold text-ink">Check-in effectué</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-body">
              Votre contrat a été signé le{" "}
              {booking.contractSignedAt ? formatDateTime(booking.contractSignedAt) : "—"}. Vous pouvez
              le consulter et l&apos;imprimer à tout moment.
            </p>
            <a
              href={`/check-in/${token}/contract`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-btn bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-dark"
            >
              Voir mon contrat ↗
            </a>
          </section>
        ) : (
          <>
            <CheckInForm token={token} />
            <p className="mt-6 text-center text-[11px] text-muted">
              Une question ? Écrivez à {booking.tenant.email}. Connexion sécurisée — vos documents
              ne sont visibles que par l&apos;agence.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4">
      <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-ink">Lien invalide</p>
        <p className="mt-2 text-[13px] text-body">
          Ce lien de check-in n&apos;est pas valable. Demandez-en un nouveau à votre agence.
        </p>
      </div>
    </main>
  );
}
