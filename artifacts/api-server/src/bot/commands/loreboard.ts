import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("loreboard")
  .setDescription("See which members have accumulated the most lore")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  // Count lore entries per member in this guild
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
    await interaction.editReply({
      content: "📜 No lore has been recorded yet. Start your legend with `/addlore`!",
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];

  const lines = await Promise.all(
    results.map(async (row, i) => {
      // Try to fetch member display name from Discord
      let name = `<@${row.discordId}>`;
      try {
        const member = await interaction.guild?.members.fetch(row.discordId);
        if (member) name = member.displayName;
      } catch {
        // Member may have left; fall back to mention
      }

      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} ${name} — **${row.count}** entr${row.count === 1 ? "y" : "ies"}`;
    }),
  );

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("📜 Lore Leaderboard")
    .setDescription(
      "The most legendary members of this server, ranked by historical significance.\n\n" +
        lines.join("\n"),
    )
    .setFooter({ text: "Use /lore @user to read their full legend" });

  await interaction.editReply({ embeds: [embed] });
}
