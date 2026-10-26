import { cn } from "@/lib/cn";

/** En-tête de page avec fil d'Ariane, façon back-office de la spec 05. */
export function PageHeader({
  title,
  breadcrumb,
  description,
  actions,
}: {
  title: string;
  breadcrumb?: string[];
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {breadcrumb?.length ? (
          <p className="mb-1 text-xs text-muted">{breadcrumb.join(" › ")}</p>
        ) : null}
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-body">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Carte de KPI : valeur, libellé, période. */
export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "brand" | "success" | "warning" | "info" | "danger" | "muted";
}) {
  const dot = {
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    danger: "bg-danger",
    muted: "bg-muted",
  }[accent];

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warning/15 text-[#8a6100]" },
  confirmed: { label: "Confirmée", className: "bg-success/15 text-success" },
  in_progress: { label: "En location", className: "bg-info/20 text-[#0b6d80]" },
  completed: { label: "Terminée", className: "bg-line text-body" },
  cancelled: { label: "Annulée", className: "bg-danger/15 text-danger" },
  declined: { label: "Refusée", className: "bg-danger/15 text-danger" },
  expired: { label: "Expirée", className: "bg-line text-body" },
};

/** Pastille de statut (mapping couleur de la spec 07). */
export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-line text-body",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

/** État vide : icône, titre, sous-titre. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden
        className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path
            d="M4 7h16M4 12h10M4 17h7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Panneau « accès refusé » — une page, pas un 404 : l'utilisateur existe. */
export function AccessDenied({
  message = "Votre rôle ne donne pas accès à cette section. Contactez le propriétaire de l'agence.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-8 text-center">
      <p className="text-sm font-semibold text-ink">Accès non autorisé</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted">{message}</p>
    </div>
  );
}
