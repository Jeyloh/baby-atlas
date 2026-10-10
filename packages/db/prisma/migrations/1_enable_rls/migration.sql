-- All data access goes through the Next.js server (Prisma, connecting as the
-- table owner, which bypasses RLS). Enabling RLS with no policies blocks the
-- Supabase anon/authenticated roles from reading tables through PostgREST.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "children" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sleep_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feeding_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diaper_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pumping_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "growth_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "temperature_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medicines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medicine_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "speech_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "potty_readiness_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vaccination_records" ENABLE ROW LEVEL SECURITY;
