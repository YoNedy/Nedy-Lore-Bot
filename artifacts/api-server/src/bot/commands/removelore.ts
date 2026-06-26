import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("removelore")
  .setDescription("Xóa mục lore mới nhất của thành viên")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("Thành viên cần xóa lore mới nhất")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);

  await interaction.deferReply({ ephemeral: true });

  const [latest] = await db
    .select()
    .from(loreEntriesTable)
    .where(
      and(
        eq(loreEntriesTable.discordId, target.id),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    )
    .orderBy(desc(loreEntriesTable.createdAt))
    .limit(1);

  if (!latest) {
    await interaction.editReply(`${target.displayName} chưa có mục lore nào.`);
    return;
  }

  await db
    .delete(loreEntriesTable)
    .where(
      and(
        eq(loreEntriesTable.id, latest.id),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    );

  await interaction.editReply(
    `đã xóa lore mới nhất của **${target.displayName}**:\n> ${latest.content}`,
  );
}
