-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('TIMER_RUNNING', 'MEDICINE_NEXT_DOSE', 'FEED_DUE', 'NAP_DUE', 'CHECKUP_REMINDER', 'VACCINE_REMINDER', 'WEEKLY_DIGEST', 'WEEKLY_TIP');

-- AlterTable
ALTER TABLE "medicines" ADD COLUMN     "max_doses_per_24h" INTEGER,
ADD COLUMN     "min_interval_hours" DOUBLE PRECISION,
ADD COLUMN     "remind_next_dose" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_success_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "user_id" TEXT NOT NULL,
    "enabled_kinds" "NotificationKind"[] DEFAULT ARRAY['TIMER_RUNNING', 'MEDICINE_NEXT_DOSE', 'CHECKUP_REMINDER', 'VACCINE_REMINDER', 'WEEKLY_DIGEST', 'WEEKLY_TIP']::"NotificationKind"[],
    "muted_child_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quiet_start" INTEGER DEFAULT 1320,
    "quiet_end" INTEGER DEFAULT 420,
    "timer_thresholds" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'nb',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "child_id" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "checkup_key" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_visits" (
    "user_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_visits_pkey" PRIMARY KEY ("user_id","child_id")
);

-- CreateTable
CREATE TABLE "parent_check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleep_hours" DOUBLE PRECISION,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_sent_at_idx" ON "notification_logs"("sent_at");

-- CreateIndex
CREATE INDEX "notification_logs_dedupe_key_idx" ON "notification_logs"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_user_id_dedupe_key_key" ON "notification_logs"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "child_visits_child_id_idx" ON "child_visits"("child_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_records_child_id_checkup_key_key" ON "checkup_records"("child_id", "checkup_key");

-- CreateIndex
CREATE UNIQUE INDEX "parent_check_ins_user_id_date_key" ON "parent_check_ins"("user_id", "date");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_records" ADD CONSTRAINT "checkup_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_visits" ADD CONSTRAINT "child_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_visits" ADD CONSTRAINT "child_visits_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_check_ins" ADD CONSTRAINT "parent_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as 1_enable_rls: with RLS on and no policies, the Supabase anon and
-- authenticated roles cannot read these tables. The app uses the owner role.
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkup_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "child_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parent_check_ins" ENABLE ROW LEVEL SECURITY;
