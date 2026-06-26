import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";

export const data = new SlashCommandBuilder()
  .setName("addlore")
  .setDescription("Add a lore entry to a server member's history")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The member to add lore for").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("text").setDescription("The lore entry text").setRequired(true).setMaxLength(500),
  )
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Type of lore (default: manual)")
      .addChoices(
        { name: "📖 Manual", value: "manual" },
        { name: "🔥 Roast", value: "roast" },
        { name: "🏆 Event", value: "event" },
        { name: "💰 Donation", value: "donation" },
        { name: "💬 Chat", value: "chat" },
      ),
  );

const CATEGORY_EMOJI: Record<string, string> = {
  chat: "💬",
  roast: "🔥",
  event: "🏆",
  donation: "💰",
  manual: "📖",
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const text = interaction.options.getString("text", true);
  const category = interaction.options.getString("category") ?? "manual";

  await interaction.deferReply();

  if (target.bot) {
    await interaction.editReply({ content: "❌ Bots don't get lore. They have no soul." });
    return;
  }

  // Upsert guild-scoped member record
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

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`✅ Lore Added`)
    .setDescription(
      `A new chapter has been written for **${target.displayName}**.\n\n${CATEGORY_EMOJI[category] ?? "📖"} *[${category}]* ${text}`,
    )
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: `Entry ID: ${entry!.id} · Added by ${interaction.user.displayName}` });

  await interaction.editReply({ embeds: [embed] });
}
