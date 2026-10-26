-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "billing_period" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "payzen_mode" AS ENUM ('TEST', 'PROD');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('android', 'ios');

-- CreateEnum
CREATE TYPE "price_type" AS ENUM ('per_day', 'per_rental');

-- CreateEnum
CREATE TYPE "fuel_type" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'lpg');

-- CreateEnum
CREATE TYPE "transmission_type" AS ENUM ('manual', 'automatic');

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('available', 'rented', 'maintenance', 'inactive');

-- CreateEnum
CREATE TYPE "dtt_alert_state" AS ENUM ('ok', 'due_soon', 'overdue');

-- CreateEnum
CREATE TYPE "damage_type" AS ENUM ('scratch', 'dent', 'crack', 'missing', 'other');

-- CreateEnum
CREATE TYPE "damage_severity" AS ENUM ('minor', 'moderate', 'major');

-- CreateEnum
CREATE TYPE "maintenance_type" AS ENUM ('service', 'repair', 'tires', 'technical_control', 'bodywork', 'other');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('planned', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('private', 'company');

-- CreateEnum
CREATE TYPE "customer_source" AS ENUM ('admin', 'online', 'phone', 'import');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('license_front', 'license_back', 'id_front', 'id_back', 'passport', 'contract', 'other');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "booking_source" AS ENUM ('admin', 'online', 'phone', 'embed');

-- CreateEnum
CREATE TYPE "duration_unit" AS ENUM ('days', 'weeks', 'months');

-- CreateEnum
CREATE TYPE "inspection_type" AS ENUM ('departure', 'return');

-- CreateEnum
CREATE TYPE "cleanliness" AS ENUM ('clean', 'dirty', 'very_dirty');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "estimate_status" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'card', 'transfer', 'check', 'payzen', 'other');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('amount', 'percent');

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "monthly_price" INTEGER NOT NULL DEFAULT 0,
    "yearly_price" INTEGER NOT NULL DEFAULT 0,
    "max_vehicles" INTEGER,
    "max_locations" INTEGER,
    "has_extra_services" BOOLEAN NOT NULL DEFAULT false,
    "has_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "has_advanced_reports" BOOLEAN NOT NULL DEFAULT false,
    "has_tva_report" BOOLEAN NOT NULL DEFAULT false,
    "has_advanced_pricing" BOOLEAN NOT NULL DEFAULT false,
    "has_full_dashboard" BOOLEAN NOT NULL DEFAULT false,
    "has_rental_contracts" BOOLEAN NOT NULL DEFAULT false,
    "has_vehicle_inspections" BOOLEAN NOT NULL DEFAULT false,
    "has_online_booking" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "manager_name" VARCHAR(160),
    "email" VARCHAR(190) NOT NULL,
    "phone" VARCHAR(40),
    "tahiti_number" VARCHAR(40),
    "address" VARCHAR(255),
    "city" VARCHAR(120),
    "zipcode" VARCHAR(20),
    "country" CHAR(2) NOT NULL DEFAULT 'PF',
    "island" VARCHAR(80),
    "logo_path" VARCHAR(255),
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Pacific/Tahiti',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'trial',
    "billing_period" "billing_period" NOT NULL DEFAULT 'monthly',
    "payment_method" VARCHAR(20) NOT NULL DEFAULT 'payzen',
    "current_price" INTEGER NOT NULL DEFAULT 0,
    "trial_start_date" TIMESTAMPTZ(6),
    "trial_end_date" TIMESTAMPTZ(6),
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "next_renewal_date" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancels_at" TIMESTAMPTZ(6),
    "external_ref" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'member',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_founder" BOOLEAN NOT NULL DEFAULT false,
    "is_deactivated" BOOLEAN NOT NULL DEFAULT false,
    "deactivated_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "remember_token" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'member',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "token" VARCHAR(80) NOT NULL,
    "invited_by" INTEGER,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_access_tokens" (
    "id" SERIAL NOT NULL,
    "tokenable_type" VARCHAR(60) NOT NULL,
    "tokenable_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "abilities" JSONB NOT NULL DEFAULT '[]',
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(120),
    "model" VARCHAR(120),
    "platform" "device_platform" NOT NULL,
    "push_token" VARCHAR(255),
    "has_push" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "company_tagline" VARCHAR(160),
    "primary_color" VARCHAR(9) NOT NULL DEFAULT '#2563eb',
    "invoice_prefix" VARCHAR(20) NOT NULL DEFAULT 'FACT-',
    "last_invoice_sequence" INTEGER NOT NULL DEFAULT 0,
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
    "invoice_due_days" INTEGER NOT NULL DEFAULT 30,
    "invoice_date_prefix" BOOLEAN NOT NULL DEFAULT false,
    "invoice_show_eur_equivalent" BOOLEAN NOT NULL DEFAULT false,
    "invoice_default_terms" TEXT,
    "invoice_footer_text" TEXT,
    "estimate_prefix" VARCHAR(20) NOT NULL DEFAULT 'DEVIS-',
    "last_estimate_sequence" INTEGER NOT NULL DEFAULT 0,
    "estimate_due_days" INTEGER NOT NULL DEFAULT 30,
    "estimate_date_prefix" BOOLEAN NOT NULL DEFAULT false,
    "estimate_show_eur_equivalent" BOOLEAN NOT NULL DEFAULT false,
    "estimate_default_terms" TEXT,
    "contract_conditions" TEXT,
    "send_booking_confirmations" BOOLEAN NOT NULL DEFAULT true,
    "send_mail_when_updating_booking" BOOLEAN NOT NULL DEFAULT true,
    "send_invoice_notifications" BOOLEAN NOT NULL DEFAULT true,
    "require_manual_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "auto_decline_hours" INTEGER NOT NULL DEFAULT 24,
    "online_booking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "online_booking_allow_offline_payment" BOOLEAN NOT NULL DEFAULT false,
    "online_booking_allow_online_payment" BOOLEAN NOT NULL DEFAULT false,
    "online_booking_auto_decline_enabled" BOOLEAN NOT NULL DEFAULT true,
    "online_booking_auto_decline_hours" INTEGER NOT NULL DEFAULT 48,
    "online_booking_min_lead_hours" INTEGER NOT NULL DEFAULT 2,
    "online_booking_turnaround_hours" INTEGER NOT NULL DEFAULT 1,
    "online_booking_primary_color" VARCHAR(9) NOT NULL DEFAULT '#FFA633',
    "enable_offline_payments" BOOLEAN NOT NULL DEFAULT false,
    "payzen_site_id" VARCHAR(60),
    "payzen_public_key" VARCHAR(255),
    "payzen_mode" "payzen_mode" NOT NULL DEFAULT 'TEST',
    "payzen_rest_endpoint" VARCHAR(255),
    "payzen_enabled_for_email" BOOLEAN NOT NULL DEFAULT false,
    "payzen_rest_key_enc" TEXT,
    "payzen_hmac_key_enc" TEXT,
    "default_currency" CHAR(3) NOT NULL DEFAULT 'XPF',
    "default_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 13.00,
    "tva_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rental_tolerance_hours" INTEGER NOT NULL DEFAULT 0,
    "dtt_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "dtt_alert_lead_days" INTEGER NOT NULL DEFAULT 30,
    "mileage_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mileage_alert_interval_km" INTEGER,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "logo_path" VARCHAR(255),
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "slug" VARCHAR(30) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "hex" VARCHAR(9) NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "vehicle_categories" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(255),
    "island" VARCHAR(80),
    "opening_hours" VARCHAR(255),
    "price" INTEGER,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_services" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "price" INTEGER NOT NULL DEFAULT 0,
    "price_type" "price_type" NOT NULL DEFAULT 'per_rental',
    "max_qty" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "license_plate" VARCHAR(30) NOT NULL,
    "make" VARCHAR(80),
    "brand_id" INTEGER,
    "model" VARCHAR(80),
    "year" SMALLINT,
    "color" VARCHAR(30),
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "seats" SMALLINT,
    "fuel_type" "fuel_type",
    "transmission_type" "transmission_type",
    "status" "vehicle_status" NOT NULL DEFAULT 'available',
    "next_technical_control_date" DATE,
    "dtt_alert_state" "dtt_alert_state" NOT NULL DEFAULT 'ok',
    "last_mileage_alert_at_km" INTEGER,
    "daily_rate" INTEGER NOT NULL DEFAULT 0,
    "weekly_rate" INTEGER,
    "monthly_rate" INTEGER,
    "base_kilometers" INTEGER,
    "extra_km_price" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "main_location_id" INTEGER,
    "category_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_images" (
    "id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_damages" (
    "id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "zone" VARCHAR(40) NOT NULL,
    "type" "damage_type" NOT NULL DEFAULT 'scratch',
    "severity" "damage_severity" NOT NULL DEFAULT 'minor',
    "description" VARCHAR(255),
    "photo_path" VARCHAR(255),
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repaired_at" TIMESTAMPTZ(6),

    CONSTRAINT "vehicle_damages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "type" "maintenance_type" NOT NULL DEFAULT 'service',
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "mileage" INTEGER,
    "performed_at" DATE,
    "next_due_date" DATE,
    "next_due_mileage" INTEGER,
    "garage" VARCHAR(160),
    "status" "maintenance_status" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "type" "customer_type" NOT NULL DEFAULT 'private',
    "is_insurance" BOOLEAN NOT NULL DEFAULT false,
    "source" "customer_source" NOT NULL DEFAULT 'admin',
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "contact_name" VARCHAR(160),
    "email" VARCHAR(190),
    "phone" VARCHAR(40),
    "phone_code" VARCHAR(8) DEFAULT '+689',
    "address" VARCHAR(255),
    "zipcode" VARCHAR(20),
    "city" VARCHAR(120),
    "country" VARCHAR(80) DEFAULT 'Polynésie française',
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "date_of_birth" DATE,
    "gender" VARCHAR(10),
    "license_card_number" VARCHAR(60),
    "license_issued_at" DATE,
    "license_expires_at" DATE,
    "license_country" VARCHAR(80),
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(160),
    "email" VARCHAR(190),
    "phone" VARCHAR(40),
    "address" VARCHAR(255),
    "zipcode" VARCHAR(20),
    "city" VARCHAR(120),
    "country" VARCHAR(80) DEFAULT 'Polynésie française',
    "tax_id" VARCHAR(60),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "booking_id" INTEGER,
    "type" "document_type" NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(80),
    "size_bytes" INTEGER,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "booking_number" VARCHAR(30) NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'pending',
    "source" "booking_source" NOT NULL DEFAULT 'admin',
    "created_by" INTEGER,
    "customer_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "show_company_on_invoice" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_id" INTEGER NOT NULL,
    "pickup_location_id" INTEGER,
    "dropoff_location_id" INTEGER,
    "start_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "end_date" DATE NOT NULL,
    "end_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "rental_days" INTEGER NOT NULL DEFAULT 1,
    "base_kilometers" INTEGER,
    "extra_km_price" INTEGER,
    "is_unlimited_kilometers" BOOLEAN NOT NULL DEFAULT true,
    "vehicle_daily_rate" INTEGER NOT NULL DEFAULT 0,
    "vehicle_weekly_rate" INTEGER,
    "vehicle_monthly_rate" INTEGER,
    "negotiated_rates" JSONB,
    "duration_unit" "duration_unit" NOT NULL DEFAULT 'days',
    "duration_value" INTEGER NOT NULL DEFAULT 1,
    "vehicle_total" INTEGER NOT NULL DEFAULT 0,
    "extras_total" INTEGER NOT NULL DEFAULT 0,
    "pickup_location_fee" INTEGER NOT NULL DEFAULT 0,
    "dropoff_location_fee" INTEGER NOT NULL DEFAULT 0,
    "discounts" JSONB NOT NULL DEFAULT '[]',
    "vehicle_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL DEFAULT 0,
    "total_price" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "total_with_tax" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internal_notes" TEXT,
    "check_in_token" UUID NOT NULL,
    "check_in_completed_at" TIMESTAMPTZ(6),
    "handed_over_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "public_report_token" UUID NOT NULL,
    "contract_signed_at" TIMESTAMPTZ(6),
    "contract_signature_ip" VARCHAR(45),
    "contract_signature_name" VARCHAR(160),
    "contract_signature_ua" TEXT,
    "contract_signature_url" VARCHAR(255),
    "has_signed_contract" BOOLEAN NOT NULL DEFAULT false,
    "caution_collected" BOOLEAN NOT NULL DEFAULT false,
    "caution_amount" INTEGER,
    "caution_collected_at" TIMESTAMPTZ(6),
    "caution_comments" TEXT,
    "caution_contract_notes" TEXT,
    "caution_released_at" TIMESTAMPTZ(6),
    "caution_refund_amount" INTEGER,
    "caution_refund_comments" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_extras" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "extra_service_id" INTEGER,
    "name" VARCHAR(120) NOT NULL,
    "unit_price" INTEGER NOT NULL DEFAULT 0,
    "price_type" "price_type" NOT NULL DEFAULT 'per_rental',
    "qty" INTEGER NOT NULL DEFAULT 1,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_drivers" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "booking_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_discounts" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "label" VARCHAR(120),
    "type" "discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "type" "inspection_type" NOT NULL,
    "mileage" INTEGER,
    "fuel_level" DECIMAL(5,2),
    "cleanliness_interior" "cleanliness" DEFAULT 'clean',
    "cleanliness_exterior" "cleanliness" DEFAULT 'clean',
    "notes" TEXT,
    "signature_path" VARCHAR(255),
    "customer_signature_name" VARCHAR(160),
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "zone" VARCHAR(40) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "taken_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_damages" (
    "id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "zone" VARCHAR(40) NOT NULL,
    "type" "damage_type" NOT NULL DEFAULT 'scratch',
    "severity" "damage_severity" NOT NULL DEFAULT 'minor',
    "description" VARCHAR(255),
    "photo_path" VARCHAR(255),

    CONSTRAINT "inspection_damages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "pdf_path" VARCHAR(255) NOT NULL,
    "pdf_hash" CHAR(64),
    "signed_at" TIMESTAMPTZ(6),
    "signer_name" VARCHAR(160),
    "signer_ip" VARCHAR(45),
    "signer_user_agent" TEXT,
    "signature_image_path" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "booking_id" INTEGER,
    "customer_id" INTEGER,
    "company_id" INTEGER,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "issued_at" DATE,
    "due_at" DATE,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "pdf_path" VARCHAR(255),
    "sent_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "estimate_number" VARCHAR(30) NOT NULL,
    "customer_id" INTEGER,
    "company_id" INTEGER,
    "vehicle_id" INTEGER,
    "status" "estimate_status" NOT NULL DEFAULT 'draft',
    "issued_at" DATE,
    "due_at" DATE,
    "start_date" DATE,
    "end_date" DATE,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "pdf_path" VARCHAR(255),
    "converted_booking_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" SERIAL NOT NULL,
    "estimate_id" INTEGER NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "booking_id" INTEGER,
    "invoice_id" INTEGER,
    "amount" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'cash',
    "status" "payment_status" NOT NULL DEFAULT 'completed',
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "category" VARCHAR(60) NOT NULL DEFAULT 'other',
    "label" VARCHAR(160) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "supplier" VARCHAR(160),
    "payment_method" VARCHAR(20),
    "vehicle_id" INTEGER,
    "attachment_path" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_amount" INTEGER,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(80) NOT NULL,
    "subject_type" VARCHAR(60),
    "subject_id" INTEGER,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_token_key" ON "personal_access_tokens"("token");

-- CreateIndex
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_idx" ON "personal_access_tokens"("tokenable_type", "tokenable_id");

-- CreateIndex
CREATE INDEX "mobile_devices_user_id_idx" ON "mobile_devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_tokens_token_key" ON "qr_tokens"("token");

-- CreateIndex
CREATE INDEX "qr_tokens_expires_at_idx" ON "qr_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenant_id_key" ON "settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_is_active_idx" ON "vehicles"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_tenant_id_license_plate_key" ON "vehicles"("tenant_id", "license_plate");

-- CreateIndex
CREATE INDEX "maintenance_vehicle_id_performed_at_idx" ON "maintenance"("vehicle_id", "performed_at");

-- CreateIndex
CREATE INDEX "customers_tenant_id_email_idx" ON "customers"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "drivers_customer_id_idx" ON "drivers"("customer_id");

-- CreateIndex
CREATE INDEX "documents_customer_id_idx" ON "documents"("customer_id");

-- CreateIndex
CREATE INDEX "documents_booking_id_idx" ON "documents"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_check_in_token_key" ON "bookings"("check_in_token");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_public_report_token_key" ON "bookings"("public_report_token");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_start_date_end_date_idx" ON "bookings"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_status_idx" ON "bookings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_start_date_end_date_idx" ON "bookings"("vehicle_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_tenant_id_booking_number_key" ON "bookings"("tenant_id", "booking_number");

-- CreateIndex
CREATE INDEX "booking_extras_booking_id_idx" ON "booking_extras"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_drivers_booking_id_driver_id_key" ON "booking_drivers"("booking_id", "driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_booking_id_type_key" ON "inspections"("booking_id", "type");

-- CreateIndex
CREATE INDEX "contracts_booking_id_idx" ON "contracts"("booking_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_tenant_id_estimate_number_key" ON "estimates"("tenant_id", "estimate_number");

-- CreateIndex
CREATE INDEX "payments_tenant_id_paid_at_idx" ON "payments"("tenant_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_date_idx" ON "expenses"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_tenant_id_code_key" ON "promo_codes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "activity_log_tenant_id_created_at_idx" ON "activity_log"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_categories" ADD CONSTRAINT "vehicle_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_services" ADD CONSTRAINT "extra_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_color_fkey" FOREIGN KEY ("color") REFERENCES "colors"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_main_location_id_fkey" FOREIGN KEY ("main_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "vehicle_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dropoff_location_id_fkey" FOREIGN KEY ("dropoff_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_extra_service_id_fkey" FOREIGN KEY ("extra_service_id") REFERENCES "extra_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_drivers" ADD CONSTRAINT "booking_drivers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_drivers" ADD CONSTRAINT "booking_drivers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_discounts" ADD CONSTRAINT "booking_discounts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_damages" ADD CONSTRAINT "inspection_damages_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_converted_booking_id_fkey" FOREIGN KEY ("converted_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
