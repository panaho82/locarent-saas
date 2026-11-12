import { readStoredFile, contentTypeFor } from "@/server/storage";

/**
 * Sert un fichier stocké (photo de permis, signature, contrat figé).
 *
 * Le nom de fichier est un UUID : l'URL n'est pas devinable. On n'expose donc
 * pas de liste, et `X-Robots-Tag` empêche l'indexation. En production, ces
 * fichiers seraient plutôt servis par des URLs signées à durée courte (S3) —
 * c'est le point d'extension prévu dans src/server/storage.ts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const relativePath = path.join("/");

  // Un chemin vide ou tentant de remonter est refusé par resolveSafe.
  try {
    const file = await readStoredFile(relativePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": contentTypeFor(relativePath),
        "cache-control": "private, max-age=3600",
        "x-robots-tag": "noindex, nofollow",
        "content-disposition": "inline",
      },
    });
  } catch {
    return new Response("Fichier introuvable", { status: 404 });
  }
}
