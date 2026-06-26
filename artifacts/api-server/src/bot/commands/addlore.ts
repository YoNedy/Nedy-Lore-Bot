import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";

export const data = new SlashCommandBuilder()
  .setName("addlore")
  .setDescription("Thêm một mục lore cho thành viên")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần thêm lore").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("text").setDescription("Nội dung lore").setRequired(true).setMaxLength(500),
  )
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Loại lore (mặc định: thủ công)")
      .addChoices(
        { name: "Thủ công", value: "manual" },
        { name: "Roast", value: "roast" },
        { name: "Sự kiện", value: "event" },
        { name: "Donate", value: "donation" },
        { name: "Chat", value: "chat" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const text = interaction.options.getString("text", true);
  const category = interaction.options.getString("category") ?? "manual";

  await interaction.deferReply({ ephemeral: true });

  if (target.bot) {
    await interaction.editReply("bot không có lore, chúng không có linh hồn");
    return;
  }

  await db
    .insert(membersTable)
    .values({
      discordId: target.id,
      guildId: interaction.guildId,
      username: target.username,
      displayName: target.displayName,
    })
    .onConflictDoUpdate({
      target: [membersTable.discordId, membersTable.guildId],
      set: {
        username: target.username,
        displayName: target.displayName,
        updatedAt: new Date(),
      },
    });

  const [entry] = await db
    .insert(loreEntriesTable)
    .values({
      discordId: target.id,
      guildId: interaction.guildId,
      content: text,
      category,
      addedByDiscordId: interaction.user.id,
    })
    .returning();

  await interaction.editReply(
    `đã thêm lore cho ${target.displayName} (id: ${entry!.id})\n> ${text}`,
  );
}
