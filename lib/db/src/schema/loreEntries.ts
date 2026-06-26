import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loreEntriesTable = pgTable("lore_entries", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  guildId: text("guild_id").notNull(),
  content: text("content").notNull(),
  // category: chat | roast | event | donation | manual
  category: text("category").notNull().default("manual"),
  addedByDiscordId: text("added_by_discord_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoreEntrySchema = createInsertSchema(loreEntriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoreEntry = z.infer<typeof insertLoreEntrySchema>;
export type LoreEntry = typeof loreEntriesTable.$inferSelect;
