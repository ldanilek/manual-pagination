import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "recalculate pages",
  { minutes: 1 }, // every minute
  internal.words.computePages,
);

export default crons;