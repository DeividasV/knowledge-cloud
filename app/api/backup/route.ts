import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function getDbName(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "").split("?")[0];
  } catch {
    return "database";
  }
}

function getPgDumpDbUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    // pg_dump does not accept Prisma's `schema` query parameter.
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return new NextResponse("DATABASE_URL is not configured", { status: 500 });
  }
  const pgDumpDbUrl = getPgDumpDbUrl();

  // Check pg_dump availability
  try {
    execSync("pg_dump --version", { timeout: 5000 });
  } catch {
    return new NextResponse(
      "pg_dump is not available. Install PostgreSQL client utilities to use backups.",
      { status: 500 }
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `knowledge-cloud-backup-${getDbName()}-${timestamp}`;
  const sqlFile = join(tmpdir(), `${baseName}.sql`);
  const zipFile = join(tmpdir(), `${baseName}.zip`);

  try {
    // 1. Dump the PostgreSQL database to SQL
    execSync(
      `pg_dump --format=plain --no-owner --no-privileges --dbname="${pgDumpDbUrl}" > "${sqlFile}"`,
      {
        cwd: process.cwd(),
        timeout: 600000,
      }
    );

    // 2. Zip the SQL file
    execSync(`zip -j "${zipFile}" "${sqlFile}"`, {
      timeout: 30000,
    });

    // 3. Read the zip file
    const zipBuffer = readFileSync(zipFile);
    const stats = statSync(zipFile);

    // 4. Clean up temp files
    try {
      unlinkSync(sqlFile);
      unlinkSync(zipFile);
    } catch {
      // ignore cleanup errors
    }

    // 5. Return as downloadable attachment
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${baseName}.zip"`,
        "Content-Length": String(stats.size),
      },
    });
  } catch (error) {
    // Clean up on error
    try {
      unlinkSync(sqlFile);
    } catch {}
    try {
      unlinkSync(zipFile);
    } catch {}

    console.error("Backup generation failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Backup failed: ${message}`, { status: 500 });
  }
}
