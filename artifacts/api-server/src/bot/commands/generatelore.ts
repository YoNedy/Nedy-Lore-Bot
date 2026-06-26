import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  Collection,
  Message,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { gemini } from "../../lib/gemini";
import { logger } from "../../lib/logger";

export const data = new SlashCommandBuilder()
  .setName("generatelore")
  .setDescription("Scan a member's messages and auto-generate AI lore for them")
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The member to generate lore for").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("entries")
      .setDescription("How many lore entries to generate (default: 3, max: 5)")
      .setMinValue(1)
      .setMaxValue(5),
  );

async function fetchUserMessages(
  channel: TextChannel,
  userId: string,
  limit: number,
): Promise<string[]> {
  const results: string[] = [];
  let lastId: string | undefined;

  while (results.length < limit) {
    const fetched: Collection<string, Message> = await channel.messages.fetch({
      limit: 100,
      ...(lastId ? { before: lastId } : {}),
    });

    if (fetched.size === 0) break;

    for (const msg of fetched.values()) {
      if (msg.author.id === userId && msg.content.trim().length > 0) {
        results.push(msg.content.trim());
        if (results.length >= limit) break;
      }
    }

    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
  }

  return results;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "this only works in a server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const count = interaction.options.getInteger("entries") ?? 3;

  if (target.bot) {
    await interaction.reply({ content: "bots don't get lore", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  await interaction.editReply(`scanning ${target.displayName}'s messages...`);

  const guild = interaction.guild!;
  const textChannels = guild.channels.cache
    .filter((ch) => ch instanceof TextChannel && ch.viewable)
    .map((ch) => ch as TextChannel);

  const sampled = textChannels.slice(0, 20);
  const allMessages: string[] = [];

  for (const channel of sampled) {
    try {
      const msgs = await fetchUserMessages(channel, target.id, 40);
      allMessages.push(...msgs);
    } catch {
      // skip channels we can't read
    }
  }

  if (allMessages.length === 0) {
    await interaction.editReply(`couldn't find any messages from ${target.displayName}`);
    return;
  }

  await interaction.editReply(
    `found ${allMessages.length} messages from ${target.displayName}, generating lore...`,
  );

  const sample = allMessages.slice(0, 150);
  const messagesText = sample.map((m, i) => `${i + 1}. ${m}`).join("\n");

  let loreEntries: string[] = [];

  try {
    const prompt = `You are a dramatic fantasy lore writer for a Discord server. Based on a member's chat messages, you write short, witty, exaggerated lore entries about them — like they're a legendary character in a server mythology. Each entry should be 1-2 sentences, funny, and rooted in something real from their messages (their topics, slang, behavior, or interests). Do NOT be mean-spirited. Write in a deadpan epic tone.

Here are ${sample.length} messages from Discord user "${target.displayName}":

${messagesText}

Write exactly ${count} lore entries about them based on these messages. Return ONLY a JSON array of ${count} strings, no extra text or markdown.`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const raw = response.text ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        loreEntries = parsed.filter((e): e is string => typeof e === "string").slice(0, count);
      }
    }
  } catch (err) {
    logger.error({ err }, "Gemini lore generation failed");
    await interaction.editReply("ai oracle is unavailable, try again later");
    return;
  }

  if (loreEntries.length === 0) {
    await interaction.editReply("ai couldn't generate lore, their legend defies comprehension");
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

  const saved = await db
    .insert(loreEntriesTable)
    .values(
      loreEntries.map((content) => ({
        discordId: target.id,
        guildId: interaction.guildId,
        content,
        category: "auto",
        addedByDiscordId: null,
      })),
    )
    .returning();

  const lines = saved.map((entry) => `— ${entry.content}`);

  await interaction.editReply(
    `lore generated for ${target.displayName}\n\n${lines.join("\n")}`,
  );
}
