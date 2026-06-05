import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const DB_PATH = "prisma/dev.db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `yt-tracker-backup-${timestamp}`;
  const sqlFile = join(tmpdir(), `${baseName}.sql`);
  const zipFile = join(tmpdir(), `${baseName}.zip`);

  try {
    // 1. Dump the SQLite database to SQL
    execSync(`sqlite3 "${DB_PATH}" ".dump" > "${sqlFile}"`, {
      cwd: process.cwd(),
      timeout: 60000,
    });

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
  } catch (error: any) {
    // Clean up on error
    try {
      unlinkSync(sqlFile);
    } catch {}
    try {
      unlinkSync(zipFile);
    } catch {}

    console.error("Backup generation failed:", error);
    return new NextResponse(
      `Backup failed: ${error.message || "Unknown error"}`,
      { status: 500 }
    );
  }
}
