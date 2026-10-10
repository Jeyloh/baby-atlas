-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'CAREGIVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "SleepType" AS ENUM ('NAP', 'NIGHT');

-- CreateEnum
CREATE TYPE "FeedingType" AS ENUM ('BREAST', 'BOTTLE', 'SOLIDS');

-- CreateEnum
CREATE TYPE "BreastSide" AS ENUM ('LEFT', 'RIGHT', 'BOTH');

-- CreateEnum
CREATE TYPE "BottleContentType" AS ENUM ('FORMULA', 'BREAST_MILK');

-- CreateEnum
CREATE TYPE "DiaperType" AS ENUM ('WET', 'DIRTY', 'BOTH', 'DRY');

-- CreateEnum
CREATE TYPE "DiaperColor" AS ENUM ('YELLOW', 'GREEN', 'BROWN', 'BLACK', 'RED', 'WHITE', 'OTHER');

-- CreateEnum
CREATE TYPE "DiaperConsistency" AS ENUM ('WATERY', 'LOOSE', 'SOFT', 'FORMED', 'HARD');

-- CreateEnum
CREATE TYPE "DiaperSize" AS ENUM ('NEWBORN', 'SIZE_1', 'SIZE_2', 'SIZE_3', 'SIZE_4', 'SIZE_5', 'SIZE_6');

-- CreateEnum
CREATE TYPE "DiaperAmount" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TUMMY_TIME', 'BATH', 'OUTDOOR_PLAY', 'INDOOR_PLAY', 'SCREEN_TIME', 'SKIN_TO_SKIN', 'STORYTIME', 'TEETH_BRUSHING', 'OTHER');

-- CreateEnum
CREATE TYPE "SpeechCategory" AS ENUM ('WORD', 'SOUND', 'SIGN');

-- CreateEnum
CREATE TYPE "PottySignal" AS ENUM ('DRY_TWO_HOURS', 'HIDES_TO_POOP', 'DISCOMFORT_DIRTY_DIAPER', 'INTEREST_IN_TOILET', 'PULLS_PANTS_UP_DOWN', 'ANNOUNCES_NEED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "quick_actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'CAREGIVER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_invites" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'CAREGIVER',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender",
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleep_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "sleep_type" "SleepType" NOT NULL DEFAULT 'NAP',
    "quality" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleep_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeding_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "feeding_type" "FeedingType" NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "side" "BreastSide",
    "left_duration_seconds" INTEGER,
    "right_duration_seconds" INTEGER,
    "amount_ml" INTEGER,
    "bottle_content_type" "BottleContentType",
    "food_items" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeding_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diaper_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "diaper_type" "DiaperType" NOT NULL,
    "color" "DiaperColor",
    "consistency" "DiaperConsistency",
    "size" "DiaperSize",
    "amount" "DiaperAmount",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diaper_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pumping_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "amount_ml" INTEGER,
    "side" "BreastSide",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pumping_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "head_circumference_cm" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temperature_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "temperature_celsius" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temperature_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_records" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "dosage_given" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_words" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "category" "SpeechCategory" NOT NULL DEFAULT 'WORD',
    "first_said_at" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speech_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potty_readiness_logs" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "signals" "PottySignal"[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potty_readiness_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "vaccine_key" TEXT NOT NULL,
    "given_at" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccination_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_invites_token_key" ON "household_invites"("token");

-- CreateIndex
CREATE INDEX "sleep_records_child_id_start_time_idx" ON "sleep_records"("child_id", "start_time");

-- CreateIndex
CREATE INDEX "feeding_records_child_id_start_time_idx" ON "feeding_records"("child_id", "start_time");

-- CreateIndex
CREATE INDEX "diaper_records_child_id_time_idx" ON "diaper_records"("child_id", "time");

-- CreateIndex
CREATE INDEX "pumping_records_child_id_start_time_idx" ON "pumping_records"("child_id", "start_time");

-- CreateIndex
CREATE INDEX "growth_records_child_id_date_idx" ON "growth_records"("child_id", "date");

-- CreateIndex
CREATE INDEX "activity_records_child_id_start_time_idx" ON "activity_records"("child_id", "start_time");

-- CreateIndex
CREATE INDEX "temperature_records_child_id_time_idx" ON "temperature_records"("child_id", "time");

-- CreateIndex
CREATE INDEX "medicine_records_medicine_id_time_idx" ON "medicine_records"("medicine_id", "time");

-- CreateIndex
CREATE INDEX "speech_words_child_id_first_said_at_idx" ON "speech_words"("child_id", "first_said_at");

-- CreateIndex
CREATE INDEX "potty_readiness_logs_child_id_time_idx" ON "potty_readiness_logs"("child_id", "time");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_records_child_id_vaccine_key_key" ON "vaccination_records"("child_id", "vaccine_key");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleep_records" ADD CONSTRAINT "sleep_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diaper_records" ADD CONSTRAINT "diaper_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pumping_records" ADD CONSTRAINT "pumping_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_records" ADD CONSTRAINT "temperature_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_records" ADD CONSTRAINT "medicine_records_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_words" ADD CONSTRAINT "speech_words_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potty_readiness_logs" ADD CONSTRAINT "potty_readiness_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
