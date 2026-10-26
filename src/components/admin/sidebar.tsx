"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Receipt,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Navigation du back-office — reprise de la structure observée (spec 05).
 *
 * Les entrées dont l'écran n'existe pas encore sont affichées désactivées :
 * l'agence voit la promesse du produit, et personne ne tombe sur un 404.
 */

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: "Principal",
    items: [
      { label: "Tableau de bord", href: "/admin/index", icon: LayoutDashboard },
      { label: "État des lieux", icon: ClipboardCheck },
    ],
  },
  {
    label: "Réservations",
    items: [
      { label: "Réservations", icon: CalendarDays },
      { label: "Calendrier", icon: CalendarDays },
      { label: "Planning", icon: Gauge },
    ],
  },
  {
    label: "Gestion",
    items: [
      { label: "Clients", icon: Users },
      { label: "Lieux", icon: MapPin },
    ],
  },
  {
    label: "Parc automobile",
    items: [
      { label: "Véhicules", icon: Car },
      { label: "Services supplémentaires", icon: Package },
      { label: "Maintenance", icon: Wrench },
    ],
  },
  {
    label: "Finance & comptabilité",
    items: [
      { label: "Factures", icon: Receipt },
      { label: "Devis", icon: FileText },
      { label: "Paiements", icon: CreditCard },
      { label: "Dépenses", icon: Wallet },
    ],
  },
  {
    label: "Rapports",
    items: [{ label: "Rapports", icon: BarChart3 }],
  },
  {
    label: "Mon abonnement",
    items: [
      { label: "Plans disponibles", icon: Package },
      { label: "Aide", icon: LifeBuoy },
    ],
  },
  {
    label: "Réglages",
    items: [
      { label: "Entreprise", href: "/admin/settings/company", icon: Building2 },
      { label: "Équipe", href: "/admin/settings/team", icon: ShieldCheck },
      { label: "Sécurité", icon: Settings2 },
    ],
  },
];

export function Sidebar({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-sidebar shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-header items-center gap-2 border-b border-line px-5">
        <span aria-hidden className="inline-block size-7 rounded-btn bg-brand" />
        <span className="truncate text-sm font-bold tracking-tight text-ink">
          {tenantName}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === pathname ||
                  (item.href && pathname.startsWith(`${item.href}/`));

                if (!item.href) {
                  return (
                    <li key={item.label}>
                      <span
                        title="Disponible dans un prochain lot"
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-btn px-2 py-1.5 text-[13px] text-muted/70"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-brand-soft font-semibold text-ink"
                          : "text-body hover:bg-app hover:text-ink",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-brand-dark" : "text-muted",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3 text-[11px] text-muted">
        Locarent · v0.1 (Lot 0)
      </div>
    </aside>
  );
}
