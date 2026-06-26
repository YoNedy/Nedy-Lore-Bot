import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("editlore")
  .setDescription("Sửa nội dung một mục lore của thành viên")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần sửa lore").setRequired(true),
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
    .limit(25);

  if (entries.length === 0) {
    await interaction.editReply(`${target.displayName} chưa có mục lore nào.`);
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("editlore_select")
    .setPlaceholder("Chọn mục lore cần sửa")
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
    content: `chọn mục lore của **${target.displayName}** cần sửa:`,
    components: [row],
  });

  let selection;
  try {
    selection = await interaction.channel!.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === "editlore_select" && i.user.id === interaction.user.id,
      time: 30_000,
    });
  } catch {
    await interaction.editReply({ content: "hết thời gian chọn.", components: [] });
    return;
  }

  const entryId = parseInt(selection.values[0]!, 10);
  const entry = entries.find((e) => e.id === entryId)!;

  const modal = new ModalBuilder()
    .setCustomId(`editlore_modal_${entryId}`)
    .setTitle("Sửa lore");

  const textInput = new TextInputBuilder()
    .setCustomId("new_content")
    .setLabel("Nội dung mới")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(entry.content)
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));

  await selection.showModal(modal);

  let modalSubmit;
  try {
    modalSubmit = await selection.awaitModalSubmit({
      filter: (i) => i.customId === `editlore_modal_${entryId}` && i.user.id === interaction.user.id,
      time: 120_000,
    });
  } catch {
    await interaction.editReply({ content: "hết thời gian nhập.", components: [] });
    return;
  }

  const newContent = modalSubmit.fields.getTextInputValue("new_content").trim();

  const [updated] = await db
    .update(loreEntriesTable)
    .set({ content: newContent })
    .where(
      and(
        eq(loreEntriesTable.id, entryId),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    )
    .returning();

  if (!updated) {
    await modalSubmit.reply({ content: "không tìm thấy mục lore đó.", ephemeral: true });
    return;
  }

  await modalSubmit.reply({
    content: `đã sửa lore của **${target.displayName}**:\n> ${updated.content}`,
    ephemeral: true,
  });

  await interaction.editReply({ content: "✅ đã sửa xong.", components: [] });
}
