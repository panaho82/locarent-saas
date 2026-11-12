import { PageHeader } from "@/components/admin/ui";
import { BookingForm } from "@/components/admin/booking-form";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { loadBookingFormOptions } from "@/server/queries/booking-form";

export const metadata = { title: "Nouvelle réservation" };

export default async function NewBookingPage() {
  const session = await requireSession();
  const options = {
    ...(await loadBookingFormOptions(session.tenantId)),
    canNegotiate: can(session, "booking.negotiate_rate"),
  };

  return (
    <>
      <PageHeader
        title="Nouvelle réservation"
        breadcrumb={["Accueil", "Réservations", "Nouvelle"]}
      />
      <BookingForm options={options} />
    </>
  );
}
