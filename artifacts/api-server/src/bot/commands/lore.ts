import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("lore")
  .setDescription("View the lore of a server member")
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The member to view lore for").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "this only works in a server", ephemeral: true });
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
    await interaction.editReply(
      `${target.displayName} has no lore yet. their legend is unwritten.`,
    );
    return;
  }

  const messageCount = member?.messageCount ?? 0;
  const shown = entries.slice(0, 10);

  const lines = shown.map((entry, i) => `${i + 1}. ${entry.content} (id: ${entry.id})`);

  const header = `📜 lore of ${target.displayName} — ${entries.length} entr${entries.length === 1 ? "y" : "ies"}, ${messageCount.toLocaleString()} messages`;
  const footer = entries.length > 10 ? `\n...and ${entries.length - 10} more` : "";

  await interaction.editReply(`${header}\n\n${lines.join("\n")}${footer}`);
}
