import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "recalculate pages",
  { hourUTC: 0, minuteUTC: 0 },
  internal.words.computePages,
);

export default crons;