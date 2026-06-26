import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
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
        { name: "Manual", value: "manual" },
        { name: "Roast", value: "roast" },
        { name: "Event", value: "event" },
        { name: "Donation", value: "donation" },
        { name: "Chat", value: "chat" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "this only works in a server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const text = interaction.options.getString("text", true);
  const category = interaction.options.getString("category") ?? "manual";

  await interaction.deferReply({ ephemeral: true });

  if (target.bot) {
    await interaction.editReply("bots don't get lore, they have no soul");
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
    `lore added for ${target.displayName} (id: ${entry!.id})\n> ${text}`,
  );
}
