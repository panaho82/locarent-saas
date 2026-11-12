"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { weekdayShort, dayOfMonth, isWeekend } from "@/lib/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/validation/booking";
import { moveBookingAction } from "@/server/actions/planning";

export type PlanningVehicle = {
  id: number;
  name: string;
  licensePlate: string;
  category: string | null;
};

export type PlanningBooking = {
  id: number;
  bookingNumber: string;
  customerName: string;
  status: string;
  startDate: string;
  endDate: string;
  vehicleId: number;
  startTime: string;
  endTime: string;
};

const BAR_STYLES: Record<string, string> = {
  pending: "bg-warning/20 border-warning/50 text-ink",
  confirmed: "bg-success/15 border-success/40 text-ink",
  in_progress: "bg-info/20 border-info/50 text-ink",
  completed: "bg-line border-line text-body",
  cancelled: "bg-danger/10 border-danger/30 text-body line-through",
  declined: "bg-danger/10 border-danger/30 text-body line-through",
  expired: "bg-line border-line text-muted",
};

/**
 * Planning flotte : véhicules en lignes, jours en colonnes.
 *
 * Les barres se déplacent par glisser-déposer natif. Le déplacement est
 * optimiste côté affichage mais **revérifié côté serveur** : si le créneau est
 * occupé, la barre revient et un message explique pourquoi.
 */
export function PlanningGrid({
  vehicles,
  bookings,
  days,
  today,
  canMove,
}: {
  vehicles: PlanningVehicle[];
  bookings: PlanningBooking[];
  days: string[];
  today: string;
  canMove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const dayIndex = (iso: string) => days.indexOf(iso);

  const onDrop = (event: React.DragEvent, vehicleId: number, date: string) => {
    const raw = Number(event.dataTransfer.getData("text/plain"));
    setDragOver(null);
    setDragging(null);
    if (!Number.isInteger(raw) || raw <= 0 || !canMove) return;

    startTransition(async () => {
      const result = await moveBookingAction({ bookingId: raw, vehicleId, startDate: date });
      setMessage({
        kind: result.status === "success" ? "success" : "error",
        text: result.message ?? (result.status === "success" ? "Réservation déplacée." : "Échec du déplacement."),
      });
      if (result.status === "success") router.refresh();
    });
  };

  return (
    <div>
      {message ? (
        <div className="mb-3">
          <Alert variant={message.kind === "error" ? "error" : "success"}>{message.text}</Alert>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <div className="min-w-[900px]">
          {/* En-tête des jours */}
          <div
            className="grid border-b border-line"
            style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(56px, 1fr))` }}
          >
            <div className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Véhicules
            </div>
            {days.map((iso) => (
              <div
                key={iso}
                className={cn(
                  "border-r border-line px-1 py-2 text-center last:border-r-0",
                  iso === today && "bg-brand-soft",
                  isWeekend(iso) && iso !== today && "bg-app",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted">{weekdayShort(iso)}</p>
                <p className={cn("text-[12px] font-semibold", iso === today ? "text-brand-text" : "text-ink")}>
                  {dayOfMonth(iso)}
                </p>
              </div>
            ))}
          </div>

          {/* Lignes véhicules */}
          {vehicles.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">
              Aucun véhicule dans le parc : ajoutez-en un pour voir le planning.
            </p>
          ) : (
            vehicles.map((vehicle) => {
              const rowBookings = bookings.filter((b) => b.vehicleId === vehicle.id);
              return (
                <div
                  key={vehicle.id}
                  className="grid border-b border-line last:border-b-0"
                  style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(56px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-2">
                    <p className="truncate text-[12px] font-semibold text-ink">{vehicle.name}</p>
                    <p className="truncate text-[10px] text-muted">
                      {vehicle.licensePlate}
                      {vehicle.category ? ` · ${vehicle.category}` : ""}
                    </p>
                  </div>

                  {/* Cellules de dépôt */}
                  <div
                    className="relative"
                    style={{ gridColumn: `2 / span ${days.length}` }}
                  >
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))` }}
                    >
                      {days.map((iso) => {
                        const key = `${vehicle.id}-${iso}`;
                        return (
                          <div
                            key={iso}
                            data-planning-cell
                            data-vehicle-id={vehicle.id}
                            data-date={iso}
                            onDragOver={(e) => {
                              if (!canMove) return;
                              e.preventDefault();
                              setDragOver(key);
                            }}
                            onDragLeave={() => setDragOver((current) => (current === key ? null : current))}
                            onDrop={(e) => {
                              e.preventDefault();
                              onDrop(e, vehicle.id, iso);
                            }}
                            className={cn(
                              "min-h-[44px] border-r border-line last:border-r-0",
                              iso === today && "bg-brand-soft/40",
                              isWeekend(iso) && iso !== today && "bg-app/60",
                              dragOver === key && "bg-brand-soft",
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Barres de réservation */}
                    {rowBookings.map((booking) => {
                      const start = dayIndex(booking.startDate);
                      const end = dayIndex(booking.endDate);
                      const from = start === -1 ? 0 : start;
                      const to = end === -1 ? days.length - 1 : end;
                      const span = Math.max(1, to - from + 1);

                      return (
                        <Link
                          key={booking.id}
                          href={`/admin/reservations/${booking.id}`}
                          draggable={canMove}
                          onDragStart={(e) => {
                            setDragging(booking.id);
                            e.dataTransfer.setData("text/plain", String(booking.id));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragging(null)}
                          className={cn(
                            "absolute top-1/2 z-20 -translate-y-1/2 overflow-hidden rounded-btn border px-1.5 py-0.5 text-[10px] leading-tight shadow-sm",
                            BAR_STYLES[booking.status] ?? "bg-line border-line",
                            dragging === booking.id && "opacity-50",
                            canMove && "cursor-grab active:cursor-grabbing",
                          )}
                          style={{
                            left: `${(from / days.length) * 100}%`,
                            width: `calc(${(span / days.length) * 100}% - 2px)`,
                          }}
                          title={`${booking.bookingNumber} · ${booking.customerName} · ${BOOKING_STATUS_LABELS[booking.status] ?? booking.status}`}
                        >
                          <span className="block truncate font-semibold">{booking.customerName}</span>
                          <span className="block truncate text-[9px] opacity-80">{booking.bookingNumber}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {pending
          ? "Déplacement en cours…"
          : canMove
            ? "Glissez une barre vers un autre jour ou un autre véhicule pour déplacer la réservation."
            : "Votre rôle ne permet pas de déplacer les réservations."}
      </p>
    </div>
  );
}
