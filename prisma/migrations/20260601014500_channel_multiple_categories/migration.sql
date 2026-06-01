-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- Migrate existing category data from Channel.category
INSERT INTO "Category" ("id", "name")
SELECT lower(hex(randomblob(16))), "category"
FROM "Channel"
WHERE "category" IS NOT NULL AND "category" != ''
GROUP BY "category";

-- CreateTable
CREATE TABLE "_CategoryToChannel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CategoryToChannel_A_fkey" FOREIGN KEY ("A") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CategoryToChannel_B_fkey" FOREIGN KEY ("B") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Link migrated categories to channels
INSERT INTO "_CategoryToChannel" ("A", "B")
SELECT c."id", ch."id"
FROM "Channel" ch
JOIN "Category" c ON c."name" = ch."category"
WHERE ch."category" IS NOT NULL AND ch."category" != '';

-- RedefineTables (drop old category column)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT,
    "uploadsPlaylistId" TEXT,
    "subscriberCount" INTEGER,
    "videoCount" INTEGER,
    "lastSyncedAt" DATETIME
);
INSERT INTO "new_Channel" ("id", "lastSyncedAt", "subscriberCount", "thumbnail", "title", "uploadsPlaylistId", "videoCount") SELECT "id", "lastSyncedAt", "subscriberCount", "thumbnail", "title", "uploadsPlaylistId", "videoCount" FROM "Channel";
DROP TABLE "Channel";
ALTER TABLE "new_Channel" RENAME TO "Channel";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_CategoryToChannel_AB_unique" ON "_CategoryToChannel"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoryToChannel_B_index" ON "_CategoryToChannel"("B");
