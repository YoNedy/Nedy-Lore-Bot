import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
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
    await interaction.reply({ content: "this only works in a server", ephemeral: true });
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
    await interaction.editReply(`no lore entry found with id ${entryId} in this server`);
    return;
  }

  await interaction.editReply(`removed lore entry ${entryId}: "${deleted.content}"`);
}
