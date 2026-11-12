import { renderContractHtml } from "@/lib/contract";
import { loadContractByCheckInToken } from "@/server/queries/contract";

/**
 * Contrat accessible depuis la page de check-in publique.
 *
 * Le token (UUID v4) fait office de capacité : il n'est transmis qu'au client
 * concerné. Aucune donnée d'une autre réservation n'est atteignable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("Lien invalide", { status: 400 });
  }

  const data = await loadContractByCheckInToken(token);
  if (!data) return new Response("Réservation introuvable", { status: 404 });

  return new Response(renderContractHtml(data), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
