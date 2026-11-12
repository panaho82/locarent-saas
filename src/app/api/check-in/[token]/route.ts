import { performCheckIn } from "@/server/checkin";

/**
 * Réception du check-in public.
 *
 * Route Handler plutôt que Server Action : l'envoi contient quatre photos et
 * peut peser plusieurs mégaoctets, au-delà de la limite de corps des actions.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Envoi illisible." }, { status: 400 });
  }

  const result = await performCheckIn(token, formData);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
