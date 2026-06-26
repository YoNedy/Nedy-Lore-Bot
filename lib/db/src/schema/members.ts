import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    guildId: text("guild_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("members_discord_guild_uniq").on(table.discordId, table.guildId),
  ],
);

export const insertMemberSchema = createInsertSchema(membersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
