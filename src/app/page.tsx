import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session-context";

/**
 * Racine du domaine.
 *
 * Il n'y a pas encore de site vitrine : ouvrir l'URL ne doit pas afficher une
 * page provisoire, mais conduire directement à l'application — au tableau de
 * bord si la session est valide, à la connexion sinon.
 *
 * Quand la page marketing publique arrivera (Lot 6), elle prendra cette place
 * et l'application passera sous `/admin`.
 */
export default async function RootPage() {
  const session = await getCurrentSession();
  redirect(session ? "/admin/index" : "/login");
}
