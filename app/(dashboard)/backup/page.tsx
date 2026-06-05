import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Database, Clock, FileArchive } from "lucide-react";
import { statSync } from "fs";

const DB_PATH = "prisma/dev.db";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  let dbSize = 0;
  let dbModified: Date | null = null;

  try {
    const stats = statSync(DB_PATH);
    dbSize = stats.size;
    dbModified = stats.mtime;
  } catch {
    // File stat failed
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup</h1>
        <p className="text-muted-foreground mt-1">
          Download a zipped SQL dump of your database for safekeeping.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database
          </CardTitle>
          <CardDescription>
            Your local SQLite database stores all channels, videos, tags, and watch status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">File</span>
            <span className="font-mono text-xs">{DB_PATH}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Size</span>
            <span className="font-medium">{formatBytes(dbSize)}</span>
          </div>
          {dbModified && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last modified</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {dbModified.toLocaleString()}
              </span>
            </div>
          )}

          <div className="pt-2">
            <a href="/api/backup" download>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Download backup
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  <FileArchive className="h-3 w-3 mr-0.5" />
                  .zip
                </Badge>
              </Button>
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            The backup is a full SQL dump of your SQLite database, compressed into a ZIP file.
            You can restore it later by running the SQL script against a fresh SQLite database.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore</CardTitle>
          <CardDescription>
            How to restore from a backup file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Stop the app if it is running</li>
            <li>Extract the <code>.zip</code> file to get the <code>.sql</code> dump</li>
            <li>Replace <code>prisma/dev.db</code> with a fresh empty file or delete it</li>
            <li>Run: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">sqlite3 prisma/dev.db &lt; backup-file.sql</code></li>
            <li>Restart the app</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
