import { createTRPCRouter } from "./trpc";
import { householdRouter } from "./routers/household";
import { childRouter } from "./routers/child";
import { sleepRouter } from "./routers/sleep";
import { feedingRouter } from "./routers/feeding";
import { diaperRouter } from "./routers/diaper";
import { pumpingRouter } from "./routers/pumping";
import { growthRouter } from "./routers/growth";
import { activityRouter } from "./routers/activity";
import { temperatureRouter } from "./routers/temperature";
import { medicineRouter } from "./routers/medicine";
import { userRouter } from "./routers/user";
import { timelineRouter } from "./routers/timeline";
import { speechRouter } from "./routers/speech";
import { pottyRouter } from "./routers/potty";
import { vaccinationRouter } from "./routers/vaccination";
import { statsRouter } from "./routers/stats";
import { journalRouter } from "./routers/journal";

export const appRouter = createTRPCRouter({
  journal: journalRouter,
  speech: speechRouter,
  potty: pottyRouter,
  vaccination: vaccinationRouter,
  stats: statsRouter,
  household: householdRouter,
  child: childRouter,
  sleep: sleepRouter,
  feeding: feedingRouter,
  diaper: diaperRouter,
  pumping: pumpingRouter,
  growth: growthRouter,
  activity: activityRouter,
  temperature: temperatureRouter,
  medicine: medicineRouter,
  user: userRouter,
  timeline: timelineRouter,
});

export type AppRouter = typeof appRouter;
