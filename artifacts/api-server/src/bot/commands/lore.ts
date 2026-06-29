import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const EMBED_DESCRIPTION_LIMIT = 4096;
const ENTRY_MAX_LENGTH = 300;

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

  const lines: string[] = [];
  let totalLength = 0;
  let shown = 0;

  for (const entry of entries) {
    const text = entry.content.length > ENTRY_MAX_LENGTH
      ? entry.content.slice(0, ENTRY_MAX_LENGTH) + "…"
      : entry.content;
    const line = `— ${text}`;
    if (totalLength + line.length + 2 > EMBED_DESCRIPTION_LIMIT) break;
    lines.push(line);
    totalLength += line.length + 2;
    shown++;
  }

  const remaining = entries.length - shown;
  const footer = remaining > 0 ? `\n*...và ${remaining} mục khác*` : "";
  const description = lines.join("\n\n") + footer;

  const embed = new EmbedBuilder()
    .setTitle(`📖 Lore của ${target.displayName}`)
    .setDescription(description)
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: `${entries.length} mục lore` })
    .setColor(0x5865f2);

  await interaction.editReply({ embeds: [embed] });
}
