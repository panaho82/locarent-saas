import { can } from "@/server/auth/permissions";
import { getCurrentSession } from "@/server/auth/session-context";
import { renderContractHtml } from "@/lib/contract";
import { loadContractForBooking } from "@/server/queries/contract";

/** Contrat imprimable de la réservation (HTML autonome, feuille A4). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new Response("Non authentifié", { status: 401 });
  if (!can(session, "contract.print")) {
    return new Response("Accès non autorisé", { status: 403 });
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) {
    return new Response("Réservation invalide", { status: 400 });
  }

  const data = await loadContractForBooking(session.tenantId, bookingId);
  if (!data) return new Response("Réservation introuvable", { status: 404 });

  return new Response(renderContractHtml(data), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
