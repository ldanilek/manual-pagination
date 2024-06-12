import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getPage } from "./pagination";
import schema from "./schema";

export const insert = mutation({
  args: { word: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("words", { word: args.word });
  },
});

export const computePages = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await ctx.scheduler.runAfter(0, internal.words.computeNextPage, {
      pageIndex: 0,
      startKey: [],
    });
  },
});

export const computeNextPage = internalMutation({
  args: { pageIndex: v.number(), startKey: v.array(v.any()) },
  handler: async (ctx, args) => {
    const { hasMore, indexKeys } = await getPage(ctx, {
      table: "words",
      startIndexKey: args.startKey,
      targetMaxRows: 1000,
      index: "word",
      schema,
    });
    console.log(`page ${args.pageIndex} has ${indexKeys.length} words`);
    const endKey = hasMore ? indexKeys[indexKeys.length - 1] : [];
    const existingPage = await ctx.db
      .query("pages")
      .withIndex("pageIndex", (q) => q.eq("pageIndex", args.pageIndex))
      .unique();
    const existingNextPage = await ctx.db
      .query("pages")
      .withIndex("pageIndex", (q) => q.eq("pageIndex", args.pageIndex + 1))
      .unique();
    if (!existingPage) {
      await ctx.db.insert("pages", {
        pageIndex: args.pageIndex,
        startKey: args.startKey,
        endKey,
      });
    } else {
      await ctx.db.patch(existingPage._id, {
        endKey,
      });
      if (existingNextPage) {
        await ctx.db.patch(existingNextPage._id, {
          startKey: endKey,
        });
      }
    }
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.words.computeNextPage, {
        pageIndex: args.pageIndex + 1,
        startKey: endKey,
      });
    } else {
      const remainingPages = await ctx.db
        .query("pages")
        .withIndex("pageIndex", (q) => q.gt("pageIndex", args.pageIndex))
        .collect();
      await Promise.all(
        remainingPages.map(async (page) => {
          await ctx.db.delete(page._id);
        })
      );
    }
  },
});

export const pageCount = query({
  args: {},
  handler: async (ctx, _args) => {
    const lastPage = await ctx.db
      .query("pages")
      .withIndex("pageIndex")
      .order("desc")
      .first();
    if (!lastPage) {
      return null;
    }
    return lastPage.pageIndex + 1;
  },
});

export const pageOfWords = query({
  args: { pageIndex: v.number() },
  handler: async (ctx, args) => {
    const pageDoc = await ctx.db
      .query("pages")
      .withIndex("pageIndex", (q) => q.eq("pageIndex", args.pageIndex))
      .unique();
    if (!pageDoc) {
      throw new Error("invalid page index");
    }
    const { page } = await getPage(ctx, {
      table: "words",
      startIndexKey: pageDoc.startKey,
      endIndexKey: pageDoc.endKey,
      index: "word",
      schema,
    });
    return page;
  },
});
