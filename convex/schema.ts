// NOTE: You can remove this file. Declaring the shape
// of the database is entirely optional in Convex.
// See https://docs.convex.dev/database/schemas.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    words: defineTable({
      word: v.string(),
    }).index("word", ["word"]),
    pages: defineTable({
      pageIndex: v.number(),
      startKey: v.array(v.any()),
      endKey: v.array(v.any()),
    }).index("pageIndex", ["pageIndex"]),
  },
);
