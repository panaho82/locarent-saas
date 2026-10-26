export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Lot 0 — socle
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Locarent</h1>
        <p className="mt-3 max-w-xl text-base">
          Gestion d&apos;agence de location de véhicules en Polynésie française.
          Le socle technique est en cours de construction.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Agences", value: "0" },
          { label: "Véhicules", value: "0" },
          { label: "Réservations", value: "0" },
          { label: "Encaissements", value: "0 XPF" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-card border border-line bg-surface p-4"
          >
            <dt className="text-xs font-medium text-muted">{kpi.label}</dt>
            <dd className="mt-1 text-xl font-bold text-ink">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted">
        Interface en français · devise XPF · fuseau Pacific/Tahiti
      </p>
    </main>
  );
}
