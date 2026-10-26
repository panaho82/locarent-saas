import Link from "next/link";

/**
 * Layout des écrans d'authentification — maquette 50/50 de la spec 07 :
 * formulaire à gauche, argumentaire à droite sur fond crème.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <header className="mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-8 rounded-btn bg-brand"
            />
            <span className="text-lg font-bold tracking-tight text-ink">
              Locarent
            </span>
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center pb-10">
          {children}
        </main>

        <footer className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>Politique de confidentialité</span>
          <span>Conditions générales</span>
          <span>Mentions légales</span>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#FFF8EF] lg:block">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-96 rounded-full bg-brand/20"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-80 rounded-full bg-brand/10"
        />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-text">
            Polynésie française
          </p>
          <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight text-ink">
            La gestion complète de votre agence de location, du comptoir à la
            plage.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-body">
            {[
              "Flotte, réservations et planning en glisser-déposer",
              "Check-in client par lien, signature et contrat PDF",
              "États des lieux photo, cautions et litiges couverts",
              "Facturation et TVA prêtes pour le comptable",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-block size-2 shrink-0 rounded-full bg-brand"
                />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-muted">
            Conçu pour la Polynésie : XPF, TVA 13 %, fuseau de Tahiti.
          </p>
        </div>
      </aside>
    </div>
  );
}
