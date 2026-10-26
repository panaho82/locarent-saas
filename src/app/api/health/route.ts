import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Sonde de santé — utilisée par Dokploy, le reverse proxy et la supervision.
 *
 * 200 : l'application répond et la base aussi.
 * 503 : la base est injoignable (le conteneur ne doit pas être mis en service).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        database: "up",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("healthcheck", error);
    return NextResponse.json(
      {
        status: "degraded",
        database: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
