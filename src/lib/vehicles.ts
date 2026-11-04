import type { FuelType, TransmissionType, VehicleStatus } from "@/generated/prisma/client";

/**
 * Libellés métier du parc automobile — repris à l'identique de l'application
 * analysée (voir recon/text/cars.txt et add-car.txt).
 */

export const FUEL_TYPES = [
  "petrol",
  "diesel",
  "electric",
  "hybrid",
  "lpg",
] as const satisfies readonly FuelType[];

export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: "Essence",
  diesel: "Diesel",
  electric: "Électrique",
  hybrid: "Hybride",
  lpg: "GPL",
};

export const TRANSMISSIONS = [
  "manual",
  "automatic",
] as const satisfies readonly TransmissionType[];

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  manual: "Manuelle",
  automatic: "Automatique",
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: "Disponible",
  rented: "En location",
  maintenance: "En maintenance",
  inactive: "Inactif",
};

/** Couleur de la pastille de statut (maquette : point coloré + libellé). */
export const VEHICLE_STATUS_DOT: Record<VehicleStatus, string> = {
  available: "bg-success",
  rented: "bg-info",
  maintenance: "bg-warning",
  inactive: "bg-muted",
};

export const SEAT_OPTIONS = [2, 4, 5, 7, 8, 9] as const;
