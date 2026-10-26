import { Bell, Moon, Plus } from "lucide-react";
import { Sidebar } from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import { requireSession } from "@/server/auth/session-context";
import { ROLE_LABELS } from "@/server/auth/permissions";

/**
 * Coquille du back-office.
 *
 * `requireSession()` est la vraie garde : le proxy ne vérifie qu'un cookie,
 * ici on valide la session en base (token, expiration, révocation, compte
 * désactivé).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const initials = session.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex min-h-dvh bg-app">
      <Sidebar tenantName={session.tenant.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-header items-center justify-between gap-4 border-b border-line bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button size="sm" disabled title="Disponible au lot 2">
              <Plus className="size-4" aria-hidden />
              Nouvelle réservation
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-btn p-2 text-muted hover:bg-app"
              aria-label="Changer de thème"
              disabled
              title="Thème sombre : lot suivant"
            >
              <Moon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="relative rounded-btn p-2 text-muted hover:bg-app"
              aria-label="Notifications"
              disabled
            >
              <Bell className="size-4" aria-hidden />
              <span className="sr-only">Aucune notification</span>
            </button>

            <div className="mx-2 h-6 w-px bg-line" aria-hidden />

            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-ink"
              >
                {initials || "?"}
              </span>
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-[13px] font-semibold leading-tight text-ink">
                  {session.name}
                </p>
                <p className="text-[11px] leading-tight text-muted">
                  {ROLE_LABELS[session.role] ?? session.role}
                </p>
              </div>
            </div>

            <form action={logoutAction} className="ml-2">
              <Button type="submit" variant="secondary" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-line px-6 py-3 text-[11px] text-muted">
          Politique de confidentialité · Conditions générales d&apos;utilisation
          et de vente · Mentions légales
        </footer>
      </div>
    </div>
  );
}
