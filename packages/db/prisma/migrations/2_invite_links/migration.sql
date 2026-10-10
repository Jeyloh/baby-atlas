-- AlterTable
ALTER TABLE "household_invites" ADD COLUMN     "invited_by_id" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
