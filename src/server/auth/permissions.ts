/**
 * Permissions granulaires — reprises à l'identique de l'application analysée
 * (spec/03-modele-donnees.md), pour ne rien perdre du modèle d'origine.
 *
 * Elles sont stockées en JSONB sur `users.permissions` et vérifiées côté
 * serveur (jamais seulement dans l'interface).
 */

export const PERMISSIONS = [
  "booking.view",
  "booking.create",
  "booking.edit",
  "booking.delete",
  "booking.confirm",
  "booking.cancel",
  "booking.negotiate_rate",
  "inspection.view",
  "inspection.create",
  "inspection.edit",
  "contract.print",
  "contract.download",
  "customer.view",
  "customer.create",
  "customer.edit",
  "customer.delete",
  "driver.view",
  "driver.create",
  "driver.edit",
  "vehicle.view",
  "vehicle.create",
  "vehicle.edit",
  "vehicle.delete",
  "maintenance.view",
  "maintenance.create",
  "maintenance.edit",
  "invoice.view",
  "invoice.create",
  "invoice.edit",
  "invoice.send",
  "invoice.delete",
  "payment.view",
  "payment.record",
  "payment.refund",
  "estimate.view",
  "estimate.create",
  "estimate.edit",
  "estimate.delete",
  "estimate.convert",
  "expense.view",
  "expense.create",
  "expense.edit",
  "expense.delete",
  "report.finance.view",
  "settings.view",
  "settings.edit",
  "catalog.view",
  "user.view",
  "user.invite",
  "user.edit",
  "user.remove",
  "subscription.view",
  "subscription.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Ne garde que les permissions connues (défense contre un JSONB corrompu). */
export function sanitizePermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}

/** Regroupement par domaine, pour l'écran Équipe. */
export const PERMISSION_GROUPS: {
  key: string;
  label: string;
  permissions: Permission[];
}[] = [
  {
    key: "booking",
    label: "Réservations",
    permissions: [
      "booking.view",
      "booking.create",
      "booking.edit",
      "booking.delete",
      "booking.confirm",
      "booking.cancel",
      "booking.negotiate_rate",
    ],
  },
  {
    key: "inspection",
    label: "États des lieux",
    permissions: ["inspection.view", "inspection.create", "inspection.edit"],
  },
  {
    key: "contract",
    label: "Contrats",
    permissions: ["contract.print", "contract.download"],
  },
  {
    key: "customer",
    label: "Clients",
    permissions: [
      "customer.view",
      "customer.create",
      "customer.edit",
      "customer.delete",
    ],
  },
  {
    key: "driver",
    label: "Conducteurs",
    permissions: ["driver.view", "driver.create", "driver.edit"],
  },
  {
    key: "vehicle",
    label: "Véhicules",
    permissions: [
      "vehicle.view",
      "vehicle.create",
      "vehicle.edit",
      "vehicle.delete",
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    permissions: ["maintenance.view", "maintenance.create", "maintenance.edit"],
  },
  {
    key: "invoice",
    label: "Factures",
    permissions: [
      "invoice.view",
      "invoice.create",
      "invoice.edit",
      "invoice.send",
      "invoice.delete",
    ],
  },
  {
    key: "payment",
    label: "Paiements",
    permissions: ["payment.view", "payment.record", "payment.refund"],
  },
  {
    key: "estimate",
    label: "Devis",
    permissions: [
      "estimate.view",
      "estimate.create",
      "estimate.edit",
      "estimate.delete",
      "estimate.convert",
    ],
  },
  {
    key: "expense",
    label: "Dépenses",
    permissions: [
      "expense.view",
      "expense.create",
      "expense.edit",
      "expense.delete",
    ],
  },
  {
    key: "report",
    label: "Rapports",
    permissions: ["report.finance.view"],
  },
  {
    key: "settings",
    label: "Réglages",
    permissions: ["settings.view", "settings.edit"],
  },
  {
    key: "catalog",
    label: "Catalogue",
    permissions: ["catalog.view"],
  },
  {
    key: "user",
    label: "Équipe",
    permissions: ["user.view", "user.invite", "user.edit", "user.remove"],
  },
  {
    key: "subscription",
    label: "Abonnement",
    permissions: ["subscription.view", "subscription.manage"],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "booking.view": "Consulter les réservations",
  "booking.create": "Créer une réservation",
  "booking.edit": "Modifier une réservation",
  "booking.delete": "Supprimer une réservation",
  "booking.confirm": "Confirmer une réservation",
  "booking.cancel": "Annuler une réservation",
  "booking.negotiate_rate": "Négocier un tarif",
  "inspection.view": "Consulter les états des lieux",
  "inspection.create": "Réaliser un état des lieux",
  "inspection.edit": "Modifier un état des lieux",
  "contract.print": "Imprimer un contrat",
  "contract.download": "Télécharger un contrat",
  "customer.view": "Consulter les clients",
  "customer.create": "Créer un client",
  "customer.edit": "Modifier un client",
  "customer.delete": "Supprimer un client",
  "driver.view": "Consulter les conducteurs",
  "driver.create": "Ajouter un conducteur",
  "driver.edit": "Modifier un conducteur",
  "vehicle.view": "Consulter les véhicules",
  "vehicle.create": "Ajouter un véhicule",
  "vehicle.edit": "Modifier un véhicule",
  "vehicle.delete": "Supprimer un véhicule",
  "maintenance.view": "Consulter la maintenance",
  "maintenance.create": "Planifier une maintenance",
  "maintenance.edit": "Modifier une maintenance",
  "invoice.view": "Consulter les factures",
  "invoice.create": "Créer une facture",
  "invoice.edit": "Modifier une facture",
  "invoice.send": "Envoyer une facture",
  "invoice.delete": "Supprimer une facture",
  "payment.view": "Consulter les paiements",
  "payment.record": "Enregistrer un paiement",
  "payment.refund": "Rembourser un paiement",
  "estimate.view": "Consulter les devis",
  "estimate.create": "Créer un devis",
  "estimate.edit": "Modifier un devis",
  "estimate.delete": "Supprimer un devis",
  "estimate.convert": "Convertir un devis en réservation",
  "expense.view": "Consulter les dépenses",
  "expense.create": "Enregistrer une dépense",
  "expense.edit": "Modifier une dépense",
  "expense.delete": "Supprimer une dépense",
  "report.finance.view": "Accéder aux rapports financiers",
  "settings.view": "Consulter les réglages",
  "settings.edit": "Modifier les réglages",
  "catalog.view": "Consulter le catalogue",
  "user.view": "Consulter l'équipe",
  "user.invite": "Inviter un membre",
  "user.edit": "Modifier un membre",
  "user.remove": "Retirer un membre",
  "subscription.view": "Consulter l'abonnement",
  "subscription.manage": "Gérer l'abonnement",
};

/**
 * Un `owner` peut tout faire : c'est le rôle créé à l'inscription, et le
 * dernier recours si une permission manque à quelqu'un.
 */
export function can(
  viewer: { role: string; permissions: readonly string[] },
  permission: Permission,
): boolean {
  if (viewer.role === "owner") return true;
  return viewer.permissions.includes(permission);
}

/** Rôles attribuables depuis l'interface (on ne « promeut » pas en owner). */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};
