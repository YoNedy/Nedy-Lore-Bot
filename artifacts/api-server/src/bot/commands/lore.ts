import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("lore")
  .setDescription("Xem lịch sử huyền thoại của một thành viên")
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần xem").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);

  await interaction.deferReply();

  const entries = await db
    .select()
    .from(loreEntriesTable)
    .where(
      and(
        eq(loreEntriesTable.discordId, target.id),
        eq(loreEntriesTable.guildId, interaction.guildId),
      ),
    )
    .orderBy(desc(loreEntriesTable.createdAt));

  if (entries.length === 0) {
    await interaction.editReply(
      `${target.displayName} chưa có lịch sử gì cả. truyền thuyết vẫn còn trống.`,
    );
    return;
  }

  const shown = entries.slice(0, 10);
  const lines = shown.map((entry) => entry.content);
  const footer = entries.length > 10 ? `\n...và ${entries.length - 10} mục khác` : "";

  await interaction.editReply(`${lines.join("\n")}${footer}`);
}
