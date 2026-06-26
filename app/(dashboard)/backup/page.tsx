import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Database, FileArchive } from "lucide-react";

function getDbInfo(): { host: string; database: string } {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, "").split("?")[0],
    };
  } catch {
    return { host: "unknown", database: "unknown" };
  }
}

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const dbInfo = getDbInfo();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup</h1>
        <p className="text-muted-foreground mt-1">
          Download a zipped SQL dump of your PostgreSQL database for safekeeping.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database
          </CardTitle>
          <CardDescription>
            Your PostgreSQL database stores all channels, videos, tags, and watch status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Host</span>
            <span className="font-mono text-xs">{dbInfo.host}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Database</span>
            <span className="font-mono text-xs">{dbInfo.database}</span>
          </div>

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
            The backup is a full SQL dump of your PostgreSQL database, compressed into a ZIP file.
            You can restore it later with <code>psql</code>.
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
            <li>Make sure the target PostgreSQL database exists and is empty</li>
            <li>Run: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">psql $DATABASE_URL &lt; backup-file.sql</code></li>
            <li>Restart the app</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
