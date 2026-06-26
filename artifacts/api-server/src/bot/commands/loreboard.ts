import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("loreboard")
  .setDescription("Xem những thành viên có nhiều lore nhất")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
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
    await interaction.editReply("chưa có lore nào được ghi lại. dùng /addlore để bắt đầu.");
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
        // thành viên có thể đã rời server
      }
      const medal = medals[i] ?? `${i + 1}.`;
      return `${medal} ${name} — ${row.count} mục`;
    }),
  );

  await interaction.editReply(`📜 bảng xếp hạng lore\n\n${lines.join("\n")}`);
}
