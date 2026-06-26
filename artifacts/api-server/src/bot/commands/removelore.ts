import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("removelore")
  .setDescription("Xóa một mục lore theo ID")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addIntegerOption((opt) =>
    opt
      .setName("id")
      .setDescription("ID của mục lore (hiển thị trong /lore)")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const entryId = interaction.options.getInteger("id", true);

  await interaction.deferReply({ ephemeral: true });

  const [deleted] = await db
    .delete(loreEntriesTable)
    .where(
      and(
        eq(loreEntriesTable.id, entryId),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    )
    .returning();

  if (!deleted) {
    await interaction.editReply(`không tìm thấy mục lore có id ${entryId} trong server này`);
    return;
  }

  await interaction.editReply(`đã xóa mục lore ${entryId}: "${deleted.content}"`);
}
