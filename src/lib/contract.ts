import { formatDate, formatDateOnly, formatXPF } from "@/lib/format";
import { unitLabel } from "@/lib/pricing";

/**
 * Contrat de location — rendu HTML autonome, imprimable.
 *
 * ⚠️ Règle métier : le contrat n'affiche **que le prix appliqué**. Quand la
 * location a été négociée, le prix catalogue n'apparaît nulle part : le client
 * signe le tarif convenu, pas une remise consentie. Le montant négocié et le
 * montant calculé restent, eux, tracés en base (`negotiated_rates`) et dans le
 * journal d'audit.
 */

export type ContractBooking = {
  bookingNumber: string;
  status: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  rentalDays: number;
  durationUnit: "days" | "weeks" | "months";
  durationValue: number;
  isUnlimitedKilometers: boolean;
  baseKilometers: number | null;
  extraKmPrice: number | null;
  vehicleTotal: number;
  extrasTotal: number;
  pickupLocationFee: number;
  dropoffLocationFee: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
  cautionAmount: number | null;
  notes: string | null;
  pickupLocationName: string | null;
  dropoffLocationName: string | null;
  extras: { name: string; total: number }[];
  discounts: { label: string | null; amount: number }[];
};

export type ContractData = {
  agency: {
    name: string;
    managerName: string | null;
    address: string | null;
    city: string | null;
    zipcode: string | null;
    phone: string | null;
    email: string;
    tahitiNumber: string | null;
  };
  customer: {
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    city: string | null;
    zipcode: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    phoneCode: string | null;
  };
  driver: {
    firstName: string;
    lastName: string;
    licenseCardNumber: string | null;
    licenseExpiresAt: string | null;
  } | null;
  vehicle: {
    name: string;
    make: string | null;
    model: string | null;
    licensePlate: string;
    color: string | null;
    mileage: number;
  };
  booking: ContractBooking;
  conditionsHtml: string | null;
  signature: {
    imageUrl: string | null;
    name: string | null;
    signedAt: string | null;
    ip: string | null;
    userAgent: string | null;
    pdfHash: string | null;
  } | null;
  generatedAt: string;
};

/** Échappe le texte injecté dans le HTML (les champs viennent de l'utilisateur). */
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function block(title: string, rows: [string, string][]): string {
  return `
    <section>
      <h2>${esc(title)}</h2>
      <dl>
        ${rows
          .map(
            ([label, value]) =>
              `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`,
          )
          .join("")}
      </dl>
    </section>`;
}

export function renderContractHtml(data: ContractData): string {
  const { agency, customer, driver, vehicle, booking, signature } = data;

  const customerName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ");
  const customerAddress = [customer.address, customer.zipcode, customer.city]
    .filter(Boolean)
    .join(", ");

  const lines: string[] = [];

  lines.push(`
    <section>
      <h2>Tarification</h2>
      <table class="lines">
        <tbody>
          <tr>
            <td>Location ${esc(booking.durationValue)} ${esc(
              unitLabel(booking.durationUnit, booking.durationValue),
            )} — ${esc(vehicle.name)}</td>
            <td class="amount">${esc(formatXPF(booking.vehicleTotal))}</td>
          </tr>
          ${booking.extras
            .map(
              (extra) =>
                `<tr><td>${esc(extra.name)}</td><td class="amount">${esc(
                  formatXPF(extra.total),
                )}</td></tr>`,
            )
            .join("")}
          ${
            booking.pickupLocationFee > 0
              ? `<tr><td>Frais de prise en charge</td><td class="amount">${esc(
                  formatXPF(booking.pickupLocationFee),
                )}</td></tr>`
              : ""
          }
          ${
            booking.dropoffLocationFee > 0
              ? `<tr><td>Frais de restitution</td><td class="amount">${esc(
                  formatXPF(booking.dropoffLocationFee),
                )}</td></tr>`
              : ""
          }
          ${booking.discounts
            .map(
              (discount) =>
                `<tr><td>${esc(discount.label ?? "Remise")}</td><td class="amount">− ${esc(
                  formatXPF(discount.amount),
                )}</td></tr>`,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td>Total hors taxes</td>
            <td class="amount">${esc(formatXPF(booking.totalPrice))}</td>
          </tr>
          ${
            booking.taxRate > 0
              ? `<tr><td>TVA ${esc(booking.taxRate)} %</td><td class="amount">${esc(
                  formatXPF(booking.taxAmount),
                )}</td></tr>`
              : ""
          }
          <tr class="total">
            <td>Total à payer</td>
            <td class="amount">${esc(formatXPF(booking.totalWithTax))}</td>
          </tr>
          ${
            booking.cautionAmount
              ? `<tr><td>Caution (dépôt de garantie)</td><td class="amount">${esc(
                  formatXPF(booking.cautionAmount),
                )}</td></tr>`
              : ""
          }
        </tfoot>
      </table>
      <p class="muted">
        ${
          booking.isUnlimitedKilometers
            ? "Kilométrage illimité."
            : `Kilométrage inclus : ${esc(booking.baseKilometers ?? 0)} km${
                booking.extraKmPrice
                  ? `, puis ${esc(formatXPF(booking.extraKmPrice))} par kilomètre supplémentaire`
                  : ""
              }.`
        }
      </p>
    </section>`);

  lines.push(
    block("Véhicule", [
      ["Véhicule", vehicle.name],
      ["Marque / modèle", [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"],
      ["Immatriculation", vehicle.licensePlate],
      ["Couleur", vehicle.color ?? "—"],
      ["Kilométrage au départ", `${vehicle.mileage} km`],
    ]),
  );

  lines.push(
    block("Période de location", [
      [
        "Départ",
        `${formatDateOnly(booking.startDate)} à ${booking.startTime}${
          booking.pickupLocationName ? ` — ${booking.pickupLocationName}` : ""
        }`,
      ],
      [
        "Retour",
        `${formatDateOnly(booking.endDate)} à ${booking.endTime}${
          booking.dropoffLocationName ? ` — ${booking.dropoffLocationName}` : ""
        }`,
      ],
      ["Durée facturée", `${booking.durationValue} ${unitLabel(booking.durationUnit, booking.durationValue)}`],
    ]),
  );

  lines.push(
    block("Locataire", [
      ["Nom", customerName || "—"],
      ["Adresse", customerAddress || "—"],
      ["Téléphone", [customer.phoneCode, customer.phone].filter(Boolean).join(" ") || "—"],
      ["Email", customer.email ?? "—"],
    ]),
  );

  if (driver) {
    lines.push(
      block("Conducteur", [
        ["Nom", `${driver.firstName} ${driver.lastName}`],
        ["Permis n°", driver.licenseCardNumber ?? "—"],
        ["Valable jusqu'au", driver.licenseExpiresAt ? formatDateOnly(driver.licenseExpiresAt) : "—"],
      ]),
    );
  }

  const signatureBlock = signature
    ? `<section class="signature">
        <h2>Signature</h2>
        <div class="signature-grid">
          <div>
            <p class="muted">Signature du locataire</p>
            ${
              signature.imageUrl
                ? `<img src="${esc(signature.imageUrl)}" alt="Signature du locataire" />`
                : `<div class="signature-empty"></div>`
            }
            <p>${esc(signature.name ?? customerName)}</p>
            <p class="muted">${esc(signature.signedAt ? formatDateOnly(signature.signedAt) : "")}</p>
          </div>
          <div>
            <p class="muted">Pour l'agence</p>
            <div class="signature-empty"></div>
            <p>${esc(agency.managerName ?? agency.name)}</p>
          </div>
        </div>
        ${
          signature.pdfHash
            ? `<p class="hash">Empreinte du contrat : ${esc(signature.pdfHash)}</p>`
            : ""
        }
        ${
          signature.ip || signature.userAgent
            ? `<p class="hash">Signé depuis ${esc(signature.ip ?? "—")} · ${esc(
                (signature.userAgent ?? "").slice(0, 120),
              )}</p>`
            : ""
        }
      </section>`
    : `<section class="signature">
        <h2>Signature</h2>
        <p class="muted">À signer par le locataire lors de la remise des clés.</p>
        <div class="signature-grid">
          <div><p class="muted">Signature du locataire</p><div class="signature-empty"></div></div>
          <div><p class="muted">Pour l'agence</p><div class="signature-empty"></div></div>
        </div>
      </section>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Contrat ${esc(booking.bookingNumber)} — ${esc(agency.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    font-size: 10.5pt;
    line-height: 1.45;
    margin: 0;
    padding: 24px;
    background: #fff;
  }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; }
  header h1 { margin: 0 0 4px; font-size: 16pt; }
  header .meta { text-align: right; font-size: 9.5pt; color: #4b5563; }
  header .agency { font-weight: 600; }
  h2 { font-size: 11pt; margin: 18px 0 6px; color: #1d4ed8; }
  section { break-inside: avoid; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 0; }
  dl > div { display: flex; gap: 6px; }
  dt { min-width: 120px; color: #4b5563; }
  dd { margin: 0; font-weight: 500; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.lines td { padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
  table.lines .amount { text-align: right; white-space: nowrap; }
  table.lines tfoot td { border-bottom: none; padding-top: 8px; }
  table.lines tfoot .total td { font-weight: 700; font-size: 12pt; border-top: 2px solid #111827; }
  .muted { color: #6b7280; font-size: 9.5pt; }
  .conditions { margin-top: 18px; font-size: 8.5pt; color: #374151; }
  .conditions h2 { font-size: 10pt; }
  .signature { margin-top: 26px; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 8px; }
  .signature-grid img { max-height: 90px; max-width: 100%; }
  .signature-empty { height: 90px; border: 1px dashed #cbd5e1; border-radius: 4px; }
  .hash { font-family: monospace; font-size: 8pt; color: #6b7280; word-break: break-all; margin-top: 10px; }
  footer { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8.5pt; color: #6b7280; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <header>
    <div>
      <div class="agency">${esc(agency.name)}</div>
      <div class="muted">
        ${esc(agency.address ?? "")}${agency.city ? `, ${esc(agency.city)}` : ""}
        ${agency.phone ? `<br />Tél. ${esc(agency.phone)}` : ""}
        ${agency.tahitiNumber ? `<br />N° TAHITI : ${esc(agency.tahitiNumber)}` : ""}
        <br />${esc(agency.email)}
      </div>
    </div>
    <div class="meta">
      <h1>Contrat de location</h1>
      <div><strong>${esc(booking.bookingNumber)}</strong></div>
      <div>Édité le ${esc(formatDate(data.generatedAt))}</div>
    </div>
  </header>

  ${lines.join("")}

  ${
    data.conditionsHtml
      ? `<section class="conditions"><h2>Conditions générales de location</h2>${data.conditionsHtml}</section>`
      : ""
  }

  ${signatureBlock}

  <footer>
    ${esc(agency.name)} — contrat de location de véhicule. Document généré le
    ${esc(formatDate(data.generatedAt))} pour la réservation ${esc(booking.bookingNumber)}.
  </footer>
</body>
</html>`;
}
