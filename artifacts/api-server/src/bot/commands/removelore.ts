import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("removelore")
  .setDescription("Remove a lore entry by its ID")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addIntegerOption((opt) =>
    opt
      .setName("id")
      .setDescription("The lore entry ID (shown in /lore output)")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
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
    await interaction.editReply({
      content: `❌ No lore entry found with ID \`${entryId}\` in this server.`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("🗑️ Lore Removed")
    .setDescription(`Entry \`#${entryId}\` has been erased from the history books.\n\n*"${deleted.content}"*`)
    .setFooter({ text: `Removed by ${interaction.user.displayName}` });

  await interaction.editReply({ embeds: [embed] });
}
