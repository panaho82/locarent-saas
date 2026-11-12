import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stockage des fichiers produits (photos de permis, signature, contrat figé).
 *
 * Deux raisons de passer par une abstraction plutôt que d'écrire directement
 * sur le disque :
 *  · les pièces d'identité ne doivent **jamais** être servies par le serveur
 *    web directement — elles passent par un chemin aléatoire et une route
 *    dédiée ;
 *  · le jour où l'on branche S3/MinIO (lot 5), seule cette couche change.
 *
 * Lecteur actuel : disque local, sous `STORAGE_DIR`. En Docker, ce dossier est
 * un volume persistant (voir docker-compose.prod.yml).
 */

const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), ".storage");

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "pdf", "html"]);

export type StoredFile = {
  /** chemin relatif, stocké en base */
  path: string;
  /** URL publique (non devinable : contient un UUID) */
  url: string;
  bytes: number;
  sha256: string;
};

function assertSafeExtension(extension: string): void {
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Extension de fichier refusée : ${extension}`);
  }
}

/** Empêche toute sortie du dossier de stockage (chemin relatif contrôlé). */
function resolveSafe(relativePath: string): string {
  const resolved = path.resolve(ROOT, relativePath);
  if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) {
    throw new Error("Chemin de fichier invalide.");
  }
  return resolved;
}

/**
 * Enregistre un fichier et renvoie son chemin, son URL et son empreinte.
 * Le nom est un UUID : impossible de deviner l'URL d'une pièce d'identité.
 */
export async function saveFile(
  data: Buffer,
  options: { folder: string; extension: string },
): Promise<StoredFile> {
  const extension = options.extension.toLowerCase();
  assertSafeExtension(extension);

  const relativePath = path.posix.join(
    options.folder,
    `${randomUUID()}.${extension}`,
  );
  const absolute = resolveSafe(relativePath);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);

  return {
    path: relativePath,
    url: `/api/files/${relativePath}`,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

/** Enregistre un fichier texte (contrat figé, HTML). */
export async function saveText(
  content: string,
  options: { folder: string; extension: "html" | "txt" },
): Promise<StoredFile> {
  return saveFile(Buffer.from(content, "utf8"), options);
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveSafe(relativePath));
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
};

export function contentTypeFor(relativePath: string): string {
  const extension = relativePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME[extension] ?? "application/octet-stream";
}

/**
 * Décode une image `data:` (sortie du canvas de signature) en buffer.
 * Refuse tout ce qui n'est pas une image PNG/JPEG.
 */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; extension: string } {
  const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error("Image de signature invalide.");

  const raw = match[1] === "jpeg" ? "jpg" : match[1];
  return { buffer: Buffer.from(match[2]!.replace(/\s/g, ""), "base64"), extension: raw };
}
