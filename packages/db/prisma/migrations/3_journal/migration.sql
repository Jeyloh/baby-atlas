-- CreateEnum
CREATE TYPE "JournalTag" AS ENUM ('SICKNESS', 'MILESTONE', 'FIRST_TIME', 'CLINIC', 'FUNNY', 'EVERYDAY');

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "author_id" TEXT,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "tags" "JournalTag"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_photos" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_child_id_date_idx" ON "journal_entries"("child_id", "date");

-- CreateIndex
CREATE INDEX "journal_photos_entry_id_position_idx" ON "journal_photos"("entry_id", "position");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_photos" ADD CONSTRAINT "journal_photos_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same as 1_enable_rls: with RLS on and no policies, the Supabase anon and
-- authenticated roles cannot read these tables. The app uses the owner role.
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_photos" ENABLE ROW LEVEL SECURITY;
