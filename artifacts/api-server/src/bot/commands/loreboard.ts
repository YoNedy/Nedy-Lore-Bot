import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("loreboard")
  .setDescription("See which members have accumulated the most lore")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "this only works in a server", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const results = await db
    .select({
      discordId: loreEntriesTable.discordId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(loreEntriesTable)
    .where(eq(loreEntriesTable.guildId, interaction.guildId))
    .groupBy(loreEntriesTable.discordId)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  if (results.length === 0) {
    await interaction.editReply("no lore recorded yet. use /addlore to start.");
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];

  const lines = await Promise.all(
    results.map(async (row, i) => {
      let name = `<@${row.discordId}>`;
      try {
        const member = await interaction.guild?.members.fetch(row.discordId);
        if (member) name = member.displayName;
      } catch {
        // member may have left
      }
      const medal = medals[i] ?? `${i + 1}.`;
      return `${medal} ${name} — ${row.count} entr${row.count === 1 ? "y" : "ies"}`;
    }),
  );

  await interaction.editReply(`📜 lore leaderboard\n\n${lines.join("\n")}`);
}
