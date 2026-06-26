import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("deletelore")
  .setDescription("Xóa một mục lore của thành viên")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần xóa lore").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);

  await interaction.deferReply({ ephemeral: true });

  const entries = await db
    .select()
    .from(loreEntriesTable)
    .where(
      and(
        eq(loreEntriesTable.discordId, target.id),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    )
    .orderBy(desc(loreEntriesTable.createdAt))
    .limit(25); // Discord select menu max

  if (entries.length === 0) {
    await interaction.editReply(`${target.displayName} chưa có mục lore nào.`);
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("deletelore_select")
    .setPlaceholder("Chọn mục lore cần xóa")
    .addOptions(
      entries.map((entry) =>
        new StringSelectMenuOptionBuilder()
          .setValue(String(entry.id))
          .setLabel(entry.content.slice(0, 100))
          .setDescription(`[${entry.category}]${entry.content.length > 100 ? " ..." : ""}`),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  await interaction.editReply({
    content: `chọn mục lore của **${target.displayName}** cần xóa:`,
    components: [row],
  });

  // Wait for the user to pick one
  let selection;
  try {
    selection = await interaction.channel!.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === "deletelore_select" && i.user.id === interaction.user.id,
      time: 30_000,
    });
  } catch {
    await interaction.editReply({ content: "hết thời gian chọn.", components: [] });
    return;
  }

  const entryId = parseInt(selection.values[0]!, 10);

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
    await selection.update({ content: "không tìm thấy mục lore đó.", components: [] });
    return;
  }

  await selection.update({
    content: `đã xóa lore của ${target.displayName}:\n> ${deleted.content}`,
    components: [],
  });
}
