import Link from "next/link";
import { EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import { formatLongDate, formatXPF } from "@/lib/format";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

/**
 * Tableau de bord.
 *
 * Les compteurs sont réellement interrogés (via la couche tenant-scoped) :
 * une agence neuve doit voir des zéros, pas des chiffres inventés.
 */
export default async function DashboardPage() {
  const session = await requireSession();

  const stats = await withTenant(session.tenantId, async () => {
    const [vehicles, customers, bookings, settings] = await Promise.all([
      db.vehicle.count(),
      db.customer.count(),
      db.booking.count(),
      db.settings.findFirst({ select: { companyTagline: true, tvaEnabled: true } }),
    ]);
    return { vehicles, customers, bookings, settings };
  });

  const firstName = session.name.split(/\s+/)[0] ?? session.name;

  const steps = [
    { label: "Configurer l'entreprise", done: Boolean(stats.settings?.companyTagline), href: "/admin/settings/company" },
    { label: "Ajouter un véhicule", done: stats.vehicles > 0, href: undefined },
    { label: "Enregistrer un client", done: stats.customers > 0, href: undefined },
    { label: "Créer une réservation", done: stats.bookings > 0, href: undefined },
    { label: "Voir le planning", done: false, href: undefined },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        breadcrumb={["Accueil", "Tableau de bord"]}
      />

      {/* Bandeau de bienvenue — orange en fond, texte foncé (contraste). */}
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-gradient-to-r from-[#FFB757] to-brand-dark px-5 py-4">
        <div>
          <p className="text-lg font-bold text-ink">
            ’Ia ora na, {firstName} !
          </p>
          <p className="text-[13px] text-ink/80">
            {formatLongDate(new Date())} · {session.tenant.name}
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="rounded-btn bg-surface/80 px-4 py-2">
            <p className="text-lg font-bold text-ink">0</p>
            <p className="text-[11px] text-body">Locations en cours</p>
          </div>
          <div className="rounded-btn bg-surface/80 px-4 py-2">
            <p className="text-lg font-bold text-ink">0</p>
            <p className="text-[11px] text-body">À venir</p>
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Réservations" value={String(stats.bookings)} hint="Ce mois" />
        <StatCard label="Encaissements" value={formatXPF(0)} hint="Ce mois" accent="success" />
        <StatCard label="Dépenses" value={formatXPF(0)} hint="Ce mois" accent="danger" />
        <StatCard
          label="Module TVA"
          value={stats.settings?.tvaEnabled ? "Activé" : "Désactivé"}
          hint={stats.settings?.tvaEnabled ? "13 % par défaut" : "À activer dans les réglages"}
          accent={stats.settings?.tvaEnabled ? "info" : "muted"}
        />
      </div>

      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Bienvenue sur Locarent
          </h2>
          <span className="text-xs text-muted">{doneCount}/5</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label="Progression de la configuration"
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${(doneCount / 5) * 100}%` }}
          />
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-start gap-2 text-[12px]">
              <span
                aria-hidden
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  step.done
                    ? "bg-success text-white"
                    : "border border-line text-muted"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              {step.href ? (
                <Link href={step.href} className="text-brand-dark hover:underline">
                  {step.label}
                </Link>
              ) : (
                <span className="text-body">{step.label}</span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">
            État des lieux du jour
          </h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-btn border border-line py-3">
              <p className="text-xl font-bold text-ink">0</p>
              <p className="text-[11px] text-muted">Départ</p>
            </div>
            <div className="rounded-btn border border-line py-3">
              <p className="text-xl font-bold text-ink">0</p>
              <p className="text-[11px] text-muted">Retour</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">Alertes véhicules</h2>
          <EmptyState
            title="Aucune alerte"
            description="Les contrôles techniques à venir apparaîtront ici."
          />
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Réservations récentes
          </h2>
          <EmptyState
            title="Aucune réservation"
            description="Vos réservations apparaîtront ici dès le lot 2."
          />
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">Factures récentes</h2>
          <EmptyState
            title="Aucune facture"
            description="Vos factures récentes apparaîtront ici."
          />
        </Card>
      </div>
    </>
  );
}
