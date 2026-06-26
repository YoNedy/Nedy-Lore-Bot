import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const CATEGORY_EMOJI: Record<string, string> = {
  chat: "💬",
  roast: "🔥",
  event: "🏆",
  donation: "💰",
  manual: "📖",
  auto: "🤖",
};

export const data = new SlashCommandBuilder()
  .setName("lore")
  .setDescription("View the legendary lore of a server member")
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The member to view lore for").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);

  await interaction.deferReply();

  const [member] = await db
    .select()
    .from(membersTable)
    .where(
      and(
        eq(membersTable.discordId, target.id),
        eq(membersTable.guildId, interaction.guildId),
      ),
    );

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
    const embed = new EmbedBuilder()
      .setColor(Colors.Grey)
      .setTitle(`📜 The Lore of ${target.displayName}`)
      .setDescription(
        `*${target.displayName} has yet to make history. Their legend remains unwritten.*\n\nUse \`/addlore\` to begin their tale.`,
      )
      .setThumbnail(target.displayAvatarURL());

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const messageCount = member?.messageCount ?? 0;

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(`📜 The Lore of ${target.displayName}`)
    .setThumbnail(target.displayAvatarURL())
    .setFooter({
      text: `${entries.length} lore entr${entries.length === 1 ? "y" : "ies"} · ${messageCount.toLocaleString()} messages sent`,
    });

  // Show up to 10 most recent entries
  const shown = entries.slice(0, 10);
  const description = shown
    .map((entry, i) => {
      const emoji = CATEGORY_EMOJI[entry.category] ?? "📖";
      const date = entry.createdAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      return `**${i + 1}.** ${emoji} *[${entry.category}]* ${entry.content}\n> — *${date}* · ID: \`${entry.id}\``;
    })
    .join("\n\n");

  embed.setDescription(description);

  if (entries.length > 10) {
    embed.addFields({
      name: `...and ${entries.length - 10} more`,
      value: `The full legend spans ${entries.length} entries. Only the most recent 10 are shown.`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
