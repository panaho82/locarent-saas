"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * Formulaire de check-in client.
 *
 * La signature est dessinée sur un canvas (souris ou doigt) puis convertie en
 * PNG au moment de l'envoi. Les photos ne sont pas retouchées côté navigateur :
 * un téléphone produit des images nettes, et le serveur impose sa limite.
 */

const PHOTOS = [
  { field: "licenseFront", label: "Permis de conduire — recto" },
  { field: "licenseBack", label: "Permis de conduire — verso" },
  { field: "idFront", label: "Pièce d'identité — recto" },
  { field: "idBack", label: "Pièce d'identité — verso" },
] as const;

export function CheckInForm({ token }: { token: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [signerName, setSignerName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const ready =
    PHOTOS.every((photo) => photos[photo.field]) && signerName.trim().length > 1 && consent;

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const position = point(event);
    if (!canvas || !ctx || !position) return;

    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const position = point(event);
    if (!ctx || !position) return;
    ctx.lineTo(position.x, position.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stop = () => {
    drawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      setError("Signez dans le cadre avant de valider.");
      return;
    }

    const formData = new FormData();
    formData.set("signerName", signerName);
    formData.set("consent", consent ? "on" : "");
    formData.set("signature", canvas.toDataURL("image/png"));
    for (const photo of PHOTOS) {
      const file = photos[photo.field];
      if (file) formData.set(photo.field, file);
    }

    setPending(true);
    try {
      const response = await fetch(`/api/check-in/${token}`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        setError(result.error ?? "Le check-in n'a pas pu être enregistré.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Connexion interrompue. Réessayez.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">1. Vos documents</h2>
        <p className="mt-1 mb-4 text-[12px] text-muted">
          Photographiez chaque document bien à plat, sans reflet.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHOTOS.map((photo) => (
            <label key={photo.field} className="block cursor-pointer">
              <span className="mb-1 block text-[13px] font-medium text-ink">{photo.label}</span>
              <span
                className={cn(
                  "flex h-24 items-center justify-center rounded-btn border-2 border-dashed px-3 text-center text-[12px]",
                  photos[photo.field]
                    ? "border-success/50 bg-success/5 text-ink"
                    : "border-line text-muted hover:border-brand/50",
                )}
              >
                {photos[photo.field]?.name ?? "Prendre une photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) =>
                  setPhotos((current) => ({
                    ...current,
                    [photo.field]: event.target.files?.[0] ?? null,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">2. Le contrat</h2>
        <p className="mt-1 mb-3 text-[12px] text-muted">
          Lisez le contrat avant de signer. Il reprend le véhicule, les dates et le
          tarif convenu.
        </p>
        <a
          href={`/check-in/${token}/contract`}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-btn border border-line px-3 py-2 text-[13px] font-medium text-ink hover:bg-app"
        >
          Ouvrir le contrat ↗
        </a>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">3. Votre signature</h2>
        <p className="mt-1 mb-3 text-[12px] text-muted">
          Signez avec le doigt ou la souris dans le cadre.
        </p>

        <canvas
          ref={canvasRef}
          width={900}
          height={260}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
          className="h-[160px] w-full touch-none rounded-btn border border-line bg-white"
          aria-label="Zone de signature"
        />

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={clearSignature}
            className="text-[12px] font-medium text-brand-text hover:underline"
          >
            Effacer
          </button>
        </div>

        <div className="mt-4">
          <Field label="Nom du signataire *" htmlFor="signerName">
            <Input
              id="signerName"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              placeholder="Nom et prénom"
              required
            />
          </Field>
        </div>

        <label className="mt-4 flex items-start gap-2 text-[12px] text-body">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 size-4 accent-[#1D4ED8]"
          />
          J&apos;ai lu le contrat et j&apos;accepte les conditions générales de location.
        </label>
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!ready || pending} className="sm:w-auto">
          {pending ? "Envoi en cours…" : "Finaliser le check-in"}
        </Button>
      </div>
    </form>
  );
}
