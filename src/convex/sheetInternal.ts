import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { sheetRowValidator } from "./schema";

/** Internal helper so the sync action can check freshness without a public round-trip. */
export const getMetaInternal = internalQuery({
  handler: async (ctx) => {
    const metas = await ctx.db.query("sheetMeta").collect();
    const m = metas[0];
    return m ? { syncedAt: m.syncedAt, rowCount: m.rowCount } : null;
  },
});

export const clearDataInternal = internalMutation({
  handler: async (ctx) => {
    const chunks = await ctx.db.query("sheetChunk").collect();
    await Promise.all(chunks.map((c) => ctx.db.delete(c._id)));
    const metas = await ctx.db.query("sheetMeta").collect();
    await Promise.all(metas.map((m) => ctx.db.delete(m._id)));
  },
});

export const insertChunkInternal = internalMutation({
  args: { chunkIndex: v.number(), rows: v.array(sheetRowValidator) },
  handler: async (ctx, { chunkIndex, rows }) => {
    await ctx.db.insert("sheetChunk", { chunkIndex, rows });
  },
});

export const insertMetaInternal = internalMutation({
  args: { syncedAt: v.number(), rowCount: v.number() },
  handler: async (ctx, { syncedAt, rowCount }) => {
    await ctx.db.insert("sheetMeta", { syncedAt, rowCount });
  },
});
