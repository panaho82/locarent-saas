-- =============================================================================
--  Invariants que le schéma Prisma ne sait pas exprimer.
--
--  Ces règles existaient en CHECK / UNIQUE dans docs/schema.sql. Prisma ne
--  modélise ni les CHECK ni les index sur expression : on les ajoute ici, dans
--  une migration dédiée, pour qu'ils survivent à chaque `migrate dev`.
-- =============================================================================

-- 1. Une location ne peut pas se terminer avant de commencer.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_dates_check" CHECK ("end_date" >= "start_date");

-- 2. Une location ne peut pas avoir une durée facturée nulle ou négative.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_duration_positive_check" CHECK ("duration_value" > 0);

-- 3. Décision D5 : l'email est globalement unique.
--    L'écran de connexion ne demande que l'email et le mot de passe ; avec un
--    unique par agence seulement, la connexion serait indécidable si deux
--    agences partageaient une adresse. Insensible à la casse.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

-- 4. Une invitation est retrouvée par son email, recherché sans casse.
CREATE INDEX "invitations_email_lower_idx" ON "invitations" (lower("email"));

-- 5. Les montants en XPF sont entiers et non négatifs.
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_rates_non_negative_check"
  CHECK (
    "daily_rate" >= 0
    AND ("weekly_rate" IS NULL OR "weekly_rate" >= 0)
    AND ("monthly_rate" IS NULL OR "monthly_rate" >= 0)
  );

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_totals_non_negative_check"
  CHECK ("total_price" >= 0 AND "tax_amount" >= 0 AND "total_with_tax" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive_check" CHECK ("amount" > 0);
