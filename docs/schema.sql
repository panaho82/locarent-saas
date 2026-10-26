-- =============================================================================
--  FenuaCar-like — schéma de reconstruction
--  PostgreSQL 14+  (voir les notes MySQL en fin de fichier)
--  Multi-tenant : toutes les tables métier portent tenant_id.
--  Montants : BIGINT en francs pacifiques (XPF), sans décimales.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
--  ABONNEMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE plans (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(60)  NOT NULL,
    slug                VARCHAR(60)  NOT NULL UNIQUE,
    monthly_price       BIGINT       NOT NULL DEFAULT 0,
    yearly_price        BIGINT       NOT NULL DEFAULT 0,
    max_vehicles        INTEGER,                        -- NULL = illimité
    max_locations       INTEGER,                        -- NULL = illimité
    has_extra_services      BOOLEAN NOT NULL DEFAULT FALSE,
    has_maintenance         BOOLEAN NOT NULL DEFAULT FALSE,
    has_advanced_reports    BOOLEAN NOT NULL DEFAULT FALSE,
    has_tva_report          BOOLEAN NOT NULL DEFAULT FALSE,
    has_advanced_pricing    BOOLEAN NOT NULL DEFAULT FALSE,
    has_full_dashboard      BOOLEAN NOT NULL DEFAULT FALSE,
    has_rental_contracts    BOOLEAN NOT NULL DEFAULT FALSE,
    has_vehicle_inspections BOOLEAN NOT NULL DEFAULT FALSE,
    has_online_booking      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  AGENCES (tenants) & UTILISATEURS
-- -----------------------------------------------------------------------------
CREATE TABLE tenants (
    id            BIGSERIAL PRIMARY KEY,
    slug          VARCHAR(80) NOT NULL UNIQUE,   -- ex. raiatea-rent-car-CYcUmp
    name          VARCHAR(160) NOT NULL,
    manager_name  VARCHAR(160),
    email         VARCHAR(190) NOT NULL,
    phone         VARCHAR(40),
    tahiti_number VARCHAR(40),                   -- n° TAHITI (identifiant fiscal local)
    address       VARCHAR(255),
    city          VARCHAR(120),
    zipcode       VARCHAR(20),
    country       CHAR(2) NOT NULL DEFAULT 'PF',
    island        VARCHAR(80),
    logo_path     VARCHAR(255),
    timezone      VARCHAR(60) NOT NULL DEFAULT 'Pacific/Tahiti',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id               BIGINT NOT NULL REFERENCES plans(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'trial'
                          CHECK (status IN ('trial','active','past_due','cancelled','expired')),
    billing_period        VARCHAR(10) NOT NULL DEFAULT 'monthly'
                          CHECK (billing_period IN ('monthly','yearly')),
    payment_method        VARCHAR(20) NOT NULL DEFAULT 'payzen',
    current_price         BIGINT NOT NULL DEFAULT 0,
    trial_start_date      TIMESTAMPTZ,
    trial_end_date        TIMESTAMPTZ,
    current_period_start  TIMESTAMPTZ,
    current_period_end    TIMESTAMPTZ,
    next_renewal_date     TIMESTAMPTZ,
    cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
    cancels_at            TIMESTAMPTZ,
    external_ref          VARCHAR(120),          -- stripe/payzen subscription id
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON subscriptions (tenant_id);

CREATE TABLE users (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name              VARCHAR(160) NOT NULL,
    email             VARCHAR(190) NOT NULL,
    password          VARCHAR(255) NOT NULL,     -- argon2id
    role              VARCHAR(20) NOT NULL DEFAULT 'member'
                      CHECK (role IN ('owner','admin','member')),
    permissions       JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_founder        BOOLEAN NOT NULL DEFAULT FALSE,
    is_deactivated    BOOLEAN NOT NULL DEFAULT FALSE,
    deactivated_at    TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    remember_token    VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE invitations (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       VARCHAR(190) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'member',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    token       VARCHAR(80) NOT NULL UNIQUE,
    invited_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal_access_tokens (
    id            BIGSERIAL PRIMARY KEY,
    tokenable_type VARCHAR(60) NOT NULL,
    tokenable_id   BIGINT NOT NULL,
    name          VARCHAR(120) NOT NULL,
    token         VARCHAR(64) NOT NULL UNIQUE,   -- sha256 du token en clair
    abilities     JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON personal_access_tokens (tokenable_type, tokenable_id);

CREATE TABLE mobile_devices (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(120),                   -- nom marketing, ex. 24117RN76O
    model        VARCHAR(120),
    platform     VARCHAR(20) NOT NULL CHECK (platform IN ('android','ios')),
    push_token   VARCHAR(255),
    has_push     BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL,           -- +90 jours
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON mobile_devices (user_id);

CREATE TABLE qr_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,      -- 48 chars aléatoires
    expires_at TIMESTAMPTZ NOT NULL,             -- +30 s
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  RÉGLAGES
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    company_tagline            VARCHAR(160),
    primary_color              VARCHAR(9) NOT NULL DEFAULT '#2563eb',

    invoice_prefix             VARCHAR(20) NOT NULL DEFAULT 'FACT-',
    last_invoice_sequence      INTEGER NOT NULL DEFAULT 0,
    next_invoice_number        INTEGER NOT NULL DEFAULT 1,
    invoice_due_days           INTEGER NOT NULL DEFAULT 30,
    invoice_date_prefix        BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_show_eur_equivalent BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_default_terms      TEXT,
    invoice_footer_text        TEXT,

    estimate_prefix            VARCHAR(20) NOT NULL DEFAULT 'DEVIS-',
    last_estimate_sequence     INTEGER NOT NULL DEFAULT 0,
    estimate_due_days          INTEGER NOT NULL DEFAULT 30,
    estimate_date_prefix       BOOLEAN NOT NULL DEFAULT FALSE,
    estimate_show_eur_equivalent BOOLEAN NOT NULL DEFAULT FALSE,
    estimate_default_terms     TEXT,

    contract_conditions        TEXT,

    send_booking_confirmations      BOOLEAN NOT NULL DEFAULT TRUE,
    send_mail_when_updating_booking BOOLEAN NOT NULL DEFAULT TRUE,
    send_invoice_notifications      BOOLEAN NOT NULL DEFAULT TRUE,
    require_manual_confirmation     BOOLEAN NOT NULL DEFAULT TRUE,
    auto_decline_hours              INTEGER NOT NULL DEFAULT 24,

    online_booking_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    online_booking_allow_offline_payment BOOLEAN NOT NULL DEFAULT FALSE,
    online_booking_allow_online_payment  BOOLEAN NOT NULL DEFAULT FALSE,
    online_booking_auto_decline_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    online_booking_auto_decline_hours    INTEGER NOT NULL DEFAULT 48,
    online_booking_min_lead_hours        INTEGER NOT NULL DEFAULT 2,
    online_booking_turnaround_hours      INTEGER NOT NULL DEFAULT 1,
    online_booking_primary_color         VARCHAR(9) NOT NULL DEFAULT '#FFA633',

    enable_offline_payments BOOLEAN NOT NULL DEFAULT FALSE,
    payzen_site_id          VARCHAR(60),
    payzen_public_key       VARCHAR(255),
    payzen_mode             VARCHAR(10) NOT NULL DEFAULT 'TEST' CHECK (payzen_mode IN ('TEST','PROD')),
    payzen_rest_endpoint    VARCHAR(255),
    payzen_enabled_for_email BOOLEAN NOT NULL DEFAULT FALSE,
    payzen_rest_key_enc     TEXT,                -- chiffré (jamais renvoyé au front)
    payzen_hmac_key_enc     TEXT,                -- chiffré

    default_currency        CHAR(3) NOT NULL DEFAULT 'XPF',
    default_tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 13.00,
    tva_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    rental_tolerance_hours  INTEGER NOT NULL DEFAULT 0,

    dtt_alerts_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    dtt_alert_lead_days     INTEGER NOT NULL DEFAULT 30,
    mileage_alerts_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    mileage_alert_interval_km INTEGER,

    onboarding_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  RÉFÉRENTIELS
-- -----------------------------------------------------------------------------
CREATE TABLE brands (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    slug        VARCHAR(80) NOT NULL UNIQUE,
    logo_path   VARCHAR(255),
    is_visible  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE colors (
    slug       VARCHAR(30) PRIMARY KEY,
    name       VARCHAR(40) NOT NULL,
    hex        VARCHAR(9) NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE vehicle_categories (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name          VARCHAR(160) NOT NULL,
    address       VARCHAR(255),
    island        VARCHAR(80),
    opening_hours VARCHAR(255),
    price         BIGINT,
    is_free       BOOLEAN NOT NULL DEFAULT FALSE,
    is_public     BOOLEAN NOT NULL DEFAULT TRUE,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extra_services (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    price       BIGINT NOT NULL DEFAULT 0,
    price_type  VARCHAR(20) NOT NULL DEFAULT 'per_rental'
                CHECK (price_type IN ('per_day','per_rental')),
    max_qty     INTEGER,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  FLOTTE
-- -----------------------------------------------------------------------------
CREATE TABLE vehicles (
    id                        BIGSERIAL PRIMARY KEY,
    tenant_id                 BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                      VARCHAR(160) NOT NULL,
    license_plate             VARCHAR(30) NOT NULL,
    make                      VARCHAR(80),
    brand_id                  BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    model                     VARCHAR(80),
    year                      SMALLINT,
    color                     VARCHAR(30) REFERENCES colors(slug) ON DELETE SET NULL,
    mileage                   INTEGER NOT NULL DEFAULT 0,
    seats                     SMALLINT,
    fuel_type                 VARCHAR(20) CHECK (fuel_type IN ('petrol','diesel','electric','hybrid','lpg')),
    transmission_type         VARCHAR(20) CHECK (transmission_type IN ('manual','automatic')),
    status                    VARCHAR(20) NOT NULL DEFAULT 'available'
                              CHECK (status IN ('available','rented','maintenance','inactive')),
    next_technical_control_date DATE,
    dtt_alert_state           VARCHAR(20) NOT NULL DEFAULT 'ok'
                              CHECK (dtt_alert_state IN ('ok','due_soon','overdue')),
    last_mileage_alert_at_km  INTEGER,
    daily_rate                BIGINT NOT NULL DEFAULT 0,
    weekly_rate               BIGINT,
    monthly_rate              BIGINT,
    base_kilometers           INTEGER,
    extra_km_price            BIGINT,
    is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
    main_location_id          BIGINT REFERENCES locations(id) ON DELETE SET NULL,
    category_id               BIGINT REFERENCES vehicle_categories(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, license_plate)
);
CREATE INDEX ON vehicles (tenant_id, is_active);

CREATE TABLE vehicle_images (
    id          BIGSERIAL PRIMARY KEY,
    vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    path        VARCHAR(255) NOT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_damages (
    id          BIGSERIAL PRIMARY KEY,
    vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    zone        VARCHAR(40) NOT NULL,            -- identifiant de zone du schéma véhicule
    type        VARCHAR(20) NOT NULL DEFAULT 'scratch'
                CHECK (type IN ('scratch','dent','crack','missing','other')),
    severity    VARCHAR(10) NOT NULL DEFAULT 'minor'
                CHECK (severity IN ('minor','moderate','major')),
    description VARCHAR(255),
    photo_path  VARCHAR(255),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    repaired_at TIMESTAMPTZ
);

CREATE TABLE maintenance (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id      BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL DEFAULT 'service'
                    CHECK (type IN ('service','repair','tires','technical_control','bodywork','other')),
    title           VARCHAR(160) NOT NULL,
    description     TEXT,
    cost            BIGINT NOT NULL DEFAULT 0,
    mileage         INTEGER,
    performed_at    DATE,
    next_due_date   DATE,
    next_due_mileage INTEGER,
    garage          VARCHAR(160),
    status          VARCHAR(20) NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','in_progress','done','cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON maintenance (vehicle_id, performed_at);

-- -----------------------------------------------------------------------------
--  CLIENTS
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type          VARCHAR(10) NOT NULL DEFAULT 'private' CHECK (type IN ('private','company')),
    is_insurance  BOOLEAN NOT NULL DEFAULT FALSE,
    source        VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','online','phone','import')),
    first_name    VARCHAR(80),
    last_name     VARCHAR(80),
    contact_name  VARCHAR(160),
    email         VARCHAR(190),
    phone         VARCHAR(40),
    phone_code    VARCHAR(8) DEFAULT '+689',
    address       VARCHAR(255),
    zipcode       VARCHAR(20),
    city          VARCHAR(120),
    country       VARCHAR(80) DEFAULT 'Polynésie française',
    notes         TEXT,
    archived_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON customers (tenant_id, email);
CREATE INDEX ON customers (tenant_id, phone);

CREATE TABLE drivers (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id         BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    first_name          VARCHAR(80) NOT NULL,
    last_name           VARCHAR(80) NOT NULL,
    date_of_birth       DATE,
    gender              VARCHAR(10),
    license_card_number VARCHAR(60),
    license_issued_at   DATE,
    license_expires_at  DATE,
    license_country     VARCHAR(80),
    is_main             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON drivers (customer_id);

CREATE TABLE companies (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name         VARCHAR(160) NOT NULL,
    contact_name VARCHAR(160),
    email        VARCHAR(190),
    phone        VARCHAR(40),
    address      VARCHAR(255),
    zipcode      VARCHAR(20),
    city         VARCHAR(120),
    country      VARCHAR(80) DEFAULT 'Polynésie française',
    tax_id       VARCHAR(60),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id  BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    booking_id   BIGINT,                          -- FK ajoutée après bookings
    type         VARCHAR(30) NOT NULL
                 CHECK (type IN ('license_front','license_back','id_front','id_back','passport','contract','other')),
    path         VARCHAR(255) NOT NULL,
    mime         VARCHAR(80),
    size_bytes   BIGINT,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON documents (customer_id);

-- -----------------------------------------------------------------------------
--  RÉSERVATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE bookings (
    id                       BIGSERIAL PRIMARY KEY,
    tenant_id                BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_number           VARCHAR(30) NOT NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','declined','expired')),
    source                   VARCHAR(20) NOT NULL DEFAULT 'admin'
                             CHECK (source IN ('admin','online','phone','embed')),
    created_by               BIGINT REFERENCES users(id) ON DELETE SET NULL,

    customer_id              BIGINT NOT NULL REFERENCES customers(id),
    company_id               BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    show_company_on_invoice  BOOLEAN NOT NULL DEFAULT FALSE,
    vehicle_id               BIGINT NOT NULL REFERENCES vehicles(id),
    pickup_location_id       BIGINT REFERENCES locations(id) ON DELETE SET NULL,
    dropoff_location_id      BIGINT REFERENCES locations(id) ON DELETE SET NULL,

    start_date               DATE NOT NULL,
    start_time               TIME NOT NULL DEFAULT '08:00',
    end_date                 DATE NOT NULL,
    end_time                 TIME NOT NULL DEFAULT '18:00',
    rental_days              INTEGER NOT NULL DEFAULT 1,

    base_kilometers          INTEGER,
    extra_km_price           BIGINT,
    is_unlimited_kilometers  BOOLEAN NOT NULL DEFAULT TRUE,

    vehicle_daily_rate       BIGINT NOT NULL DEFAULT 0,
    vehicle_weekly_rate      BIGINT,
    vehicle_monthly_rate     BIGINT,
    negotiated_rates         JSONB,
    duration_unit            VARCHAR(10) NOT NULL DEFAULT 'days'
                             CHECK (duration_unit IN ('days','weeks','months')),
    duration_value           INTEGER NOT NULL DEFAULT 1,

    vehicle_total            BIGINT NOT NULL DEFAULT 0,
    extras_total             BIGINT NOT NULL DEFAULT 0,
    pickup_location_fee      BIGINT NOT NULL DEFAULT 0,
    dropoff_location_fee     BIGINT NOT NULL DEFAULT 0,
    discounts                JSONB NOT NULL DEFAULT '[]'::jsonb,
    vehicle_tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
    grand_total              BIGINT NOT NULL DEFAULT 0,
    total_price              BIGINT NOT NULL DEFAULT 0,
    tax_rate                 NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount               BIGINT NOT NULL DEFAULT 0,
    total_with_tax           BIGINT NOT NULL DEFAULT 0,

    notes                    TEXT,
    internal_notes           TEXT,

    check_in_token           UUID NOT NULL DEFAULT gen_random_uuid(),
    check_in_completed_at    TIMESTAMPTZ,
    handed_over_at           TIMESTAMPTZ,
    returned_at              TIMESTAMPTZ,
    public_report_token      UUID NOT NULL DEFAULT gen_random_uuid(),

    contract_signed_at       TIMESTAMPTZ,
    contract_signature_ip    INET,
    contract_signature_name  VARCHAR(160),
    contract_signature_ua    TEXT,
    contract_signature_url   VARCHAR(255),
    has_signed_contract      BOOLEAN NOT NULL DEFAULT FALSE,

    caution_collected        BOOLEAN NOT NULL DEFAULT FALSE,
    caution_amount           BIGINT,
    caution_collected_at     TIMESTAMPTZ,
    caution_comments         TEXT,
    caution_contract_notes   TEXT,
    caution_released_at      TIMESTAMPTZ,
    caution_refund_amount    BIGINT,
    caution_refund_comments  TEXT,

    cancelled_at             TIMESTAMPTZ,
    cancellation_reason      VARCHAR(255),

    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, booking_number),
    UNIQUE (check_in_token),
    UNIQUE (public_report_token),
    CHECK (end_date >= start_date)
);
CREATE INDEX ON bookings (tenant_id, start_date, end_date);
CREATE INDEX ON bookings (tenant_id, status);
CREATE INDEX ON bookings (vehicle_id, start_date, end_date);
CREATE INDEX ON bookings (customer_id);

ALTER TABLE documents
    ADD CONSTRAINT documents_booking_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

CREATE TABLE booking_extras (
    id               BIGSERIAL PRIMARY KEY,
    booking_id       BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    extra_service_id BIGINT REFERENCES extra_services(id) ON DELETE SET NULL,
    name             VARCHAR(120) NOT NULL,      -- figé
    unit_price       BIGINT NOT NULL DEFAULT 0,  -- figé
    price_type       VARCHAR(20) NOT NULL DEFAULT 'per_rental',
    qty              INTEGER NOT NULL DEFAULT 1,
    total            BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX ON booking_extras (booking_id);

CREATE TABLE booking_drivers (
    id         BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    driver_id  BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    is_main    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (booking_id, driver_id)
);

CREATE TABLE booking_discounts (
    id         BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    label      VARCHAR(120),
    type       VARCHAR(10) NOT NULL CHECK (type IN ('amount','percent')),
    value      NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount     BIGINT NOT NULL DEFAULT 0
);

-- ---- États des lieux ---------------------------------------------------------
CREATE TABLE inspections (
    id                        BIGSERIAL PRIMARY KEY,
    tenant_id                 BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id                BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type                      VARCHAR(10) NOT NULL CHECK (type IN ('departure','return')),
    mileage                   INTEGER,
    fuel_level                NUMERIC(5,2),       -- 0..100
    cleanliness_interior      VARCHAR(20) DEFAULT 'clean'
                              CHECK (cleanliness_interior IN ('clean','dirty','very_dirty')),
    cleanliness_exterior      VARCHAR(20) DEFAULT 'clean'
                              CHECK (cleanliness_exterior IN ('clean','dirty','very_dirty')),
    notes                     TEXT,
    signature_path            VARCHAR(255),
    customer_signature_name   VARCHAR(160),
    completed_at              TIMESTAMPTZ,
    completed_by              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, type)
);

CREATE TABLE inspection_photos (
    id            BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    zone          VARCHAR(40) NOT NULL,
    path          VARCHAR(255) NOT NULL,
    taken_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspection_damages (
    id            BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    zone          VARCHAR(40) NOT NULL,
    type          VARCHAR(20) NOT NULL DEFAULT 'scratch'
                  CHECK (type IN ('scratch','dent','crack','missing','other')),
    severity      VARCHAR(10) NOT NULL DEFAULT 'minor'
                  CHECK (severity IN ('minor','moderate','major')),
    description   VARCHAR(255),
    photo_path    VARCHAR(255)
);

CREATE TABLE contracts (
    id                    BIGSERIAL PRIMARY KEY,
    booking_id            BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    version               INTEGER NOT NULL DEFAULT 1,
    pdf_path              VARCHAR(255) NOT NULL,
    pdf_hash              CHAR(64),              -- SHA-256 du PDF (preuve)
    signed_at             TIMESTAMPTZ,
    signer_name           VARCHAR(160),
    signer_ip             INET,
    signer_user_agent     TEXT,
    signature_image_path  VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  FINANCE
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(30) NOT NULL,
    booking_id     BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    customer_id    BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    company_id     BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled')),
    issued_at      DATE,
    due_at         DATE,
    subtotal       BIGINT NOT NULL DEFAULT 0,
    tax_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount     BIGINT NOT NULL DEFAULT 0,
    discount       BIGINT NOT NULL DEFAULT 0,
    total          BIGINT NOT NULL DEFAULT 0,
    amount_paid    BIGINT NOT NULL DEFAULT 0,
    balance        BIGINT NOT NULL DEFAULT 0,
    notes          TEXT,
    terms          TEXT,
    pdf_path       VARCHAR(255),
    sent_at        TIMESTAMPTZ,
    paid_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE invoice_lines (
    id          BIGSERIAL PRIMARY KEY,
    invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price  BIGINT NOT NULL DEFAULT 0,
    tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
    total       BIGINT NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE estimates (
    id                   BIGSERIAL PRIMARY KEY,
    tenant_id            BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estimate_number      VARCHAR(30) NOT NULL,
    customer_id          BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    company_id           BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    vehicle_id           BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','sent','accepted','declined','expired','converted')),
    issued_at            DATE,
    due_at               DATE,
    start_date           DATE,
    end_date             DATE,
    subtotal             BIGINT NOT NULL DEFAULT 0,
    tax_rate             NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount           BIGINT NOT NULL DEFAULT 0,
    total                BIGINT NOT NULL DEFAULT 0,
    notes                TEXT,
    terms                TEXT,
    pdf_path             VARCHAR(255),
    converted_booking_id BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, estimate_number)
);

CREATE TABLE estimate_lines (
    id          BIGSERIAL PRIMARY KEY,
    estimate_id BIGINT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price  BIGINT NOT NULL DEFAULT 0,
    tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
    total       BIGINT NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE payments (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id  BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    invoice_id  BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
    amount      BIGINT NOT NULL,
    method      VARCHAR(20) NOT NULL DEFAULT 'cash'
                CHECK (method IN ('cash','card','transfer','check','payzen','other')),
    status      VARCHAR(20) NOT NULL DEFAULT 'completed'
                CHECK (status IN ('pending','completed','failed','refunded')),
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference   VARCHAR(120),                    -- transaction PayZen
    notes       TEXT,
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON payments (tenant_id, paid_at);
CREATE INDEX ON payments (booking_id);

CREATE TABLE expenses (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category        VARCHAR(60) NOT NULL DEFAULT 'other',
    label           VARCHAR(160) NOT NULL,
    amount          BIGINT NOT NULL DEFAULT 0,
    tax_amount      BIGINT NOT NULL DEFAULT 0,
    date            DATE NOT NULL,
    supplier        VARCHAR(160),
    payment_method  VARCHAR(20),
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    attachment_path VARCHAR(255),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON expenses (tenant_id, date);

CREATE TABLE promo_codes (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code        VARCHAR(40) NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('percent','amount')),
    value       NUMERIC(10,2) NOT NULL,
    min_amount  BIGINT,
    max_uses    INTEGER,
    used_count  INTEGER NOT NULL DEFAULT 0,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(60) NOT NULL,
    title      VARCHAR(160) NOT NULL,
    message    TEXT,
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON notifications (user_id, read_at);

CREATE TABLE activity_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(80) NOT NULL,           -- booking.confirmed, invoice.sent…
    subject_type VARCHAR(60),
    subject_id   BIGINT,
    properties   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip           INET,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON activity_log (tenant_id, created_at);

-- -----------------------------------------------------------------------------
--  SEED MINIMAL (plans)
-- -----------------------------------------------------------------------------
INSERT INTO plans (name, slug, monthly_price, yearly_price, max_vehicles, max_locations,
                   has_extra_services, has_maintenance, has_advanced_reports, has_tva_report,
                   has_advanced_pricing, has_full_dashboard, has_rental_contracts,
                   has_vehicle_inspections, has_online_booking, sort_order)
VALUES
 ('Basique',   'basique',   1990,  19900, 3,    1,
  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 1),
 ('Essentiel', 'essentiel', 4990,  49900, 10,   NULL, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, 2),
 ('PRO',       'pro',       7990,  79900, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 3);

INSERT INTO colors (slug, name, hex) VALUES
 ('white','Blanc','#FFFFFF'), ('black','Noir','#1a1a1a'), ('gray','Gris','#6B7280'),
 ('silver','Argent','#C0C0C0'), ('red','Rouge','#DC3545'), ('blue','Bleu','#0DCAF0'),
 ('green','Vert','#198754'), ('yellow','Jaune','#EAB308'), ('orange','Orange','#F97316'),
 ('brown','Marron','#92400E'), ('beige','Beige','#D9C3A5'), ('purple','Violet','#7C3AED');

-- =============================================================================
--  Notes MySQL 8 : remplacer BIGSERIAL par BIGINT AUTO_INCREMENT, JSONB par JSON,
--  TIMESTAMPTZ par TIMESTAMP, INET par VARCHAR(45), gen_random_uuid() par UUID().
--  Les CHECK sont supportés à partir de MySQL 8.0.16.
-- =============================================================================
