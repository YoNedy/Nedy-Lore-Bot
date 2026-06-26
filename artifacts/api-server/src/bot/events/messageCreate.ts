import { Client, Message } from "discord.js";
import { db, membersTable, loreEntriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getMilestone } from "../milestones";
import { logger } from "../../lib/logger";

export function registerMessageCreateEvent(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guildId) return;

    const discordId = message.author.id;
    const guildId = message.guildId;

    try {
      // Upsert member (guild-scoped) and increment message count atomically
      const result = await db
        .insert(membersTable)
        .values({
          discordId,
          guildId,
          username: message.author.username,
          displayName: message.member?.displayName ?? message.author.displayName,
          messageCount: 1,
        })
        .onConflictDoUpdate({
          target: [membersTable.discordId, membersTable.guildId],
          set: {
            username: message.author.username,
            displayName: message.member?.displayName ?? message.author.displayName,
            messageCount: sql`${membersTable.messageCount} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ messageCount: membersTable.messageCount });

      const newCount = result[0]?.messageCount ?? 1;
      const previousCount = newCount - 1;

      const milestone = getMilestone(previousCount, newCount);
      if (milestone) {
        await db.insert(loreEntriesTable).values({
          discordId,
          guildId,
          content: milestone.lore,
          category: "chat",
          addedByDiscordId: null,
        });

        logger.info(
          { discordId, guildId, messageCount: newCount },
          "Milestone lore entry created",
        );

        // Announce in the channel where the milestone was hit
        try {
          if ("send" in message.channel) {
            const name = message.member?.displayName ?? message.author.displayName;
            await message.channel.send(
              `${name} just hit ${newCount} messages — ${milestone.lore}`,
            );
          }
        } catch {
          // Channel may not allow bot messages; swallow silently
        }
      }
    } catch (err) {
      logger.error({ err, discordId, guildId }, "Error handling messageCreate for lore tracking");
    }
  });
}
