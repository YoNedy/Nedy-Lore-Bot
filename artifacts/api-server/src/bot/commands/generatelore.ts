import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  TextChannel,
  Collection,
  Message,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { openai } from "../../lib/openai";
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

/** Fetch up to `limit` messages from a single channel authored by `userId` */
async function fetchUserMessages(
  channel: TextChannel,
  userId: string,
  limit: number,
): Promise<string[]> {
  const results: string[] = [];
  let lastId: string | undefined;

  // Paginate through channel history to collect user messages
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

    // Stop if we got fewer than 100 (reached channel start)
    if (fetched.size < 100) break;
  }

  return results;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const count = interaction.options.getInteger("entries") ?? 3;

  if (target.bot) {
    await interaction.reply({ content: "❌ Bots have no stories worth telling.", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  await interaction.editReply(`🔍 Scanning ${target.displayName}'s message history... this may take a moment.`);

  // Collect text channels the bot can read
  const guild = interaction.guild!;
  const textChannels = guild.channels.cache
    .filter((ch) => ch instanceof TextChannel && ch.viewable)
    .map((ch) => ch as TextChannel);

  // Gather up to 40 messages per channel, across up to 20 channels
  const MAX_PER_CHANNEL = 40;
  const MAX_CHANNELS = 20;
  const sampled = textChannels.slice(0, MAX_CHANNELS);

  const allMessages: string[] = [];

  for (const channel of sampled) {
    try {
      const msgs = await fetchUserMessages(channel, target.id, MAX_PER_CHANNEL);
      allMessages.push(...msgs);
    } catch {
      // Skip channels with no read permission
    }
  }

  if (allMessages.length === 0) {
    await interaction.editReply(
      `❌ Couldn't find any messages from ${target.displayName}. They may be a ghost.`,
    );
    return;
  }

  await interaction.editReply(
    `📜 Found **${allMessages.length}** messages from ${target.displayName}. Consulting the ancient scrolls...`,
  );

  // Sample up to 150 messages to keep prompt size reasonable
  const sample = allMessages.slice(0, 150);
  const messagesText = sample.map((m, i) => `${i + 1}. ${m}`).join("\n");

  let loreEntries: string[] = [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are a dramatic fantasy lore writer for a Discord server. Based on a member's chat messages, you write short, witty, exaggerated lore entries about them — like they're a legendary character in a server mythology. Each entry should be 1-2 sentences, funny, and rooted in something real from their messages (their topics, slang, behavior, or interests). Do NOT be mean-spirited. Write in a deadpan epic tone. Return ONLY a JSON array of strings, each being one lore entry. No extra text.`,
        },
        {
          role: "user",
          content: `Here are ${sample.length} messages from Discord user "${target.displayName}":\n\n${messagesText}\n\nWrite exactly ${count} lore entries about them based on these messages. Return a JSON array of ${count} strings.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";

    // Extract JSON array from response (handle any markdown wrapping)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        loreEntries = parsed.filter((e): e is string => typeof e === "string").slice(0, count);
      }
    }
  } catch (err) {
    logger.error({ err }, "OpenAI lore generation failed");
    await interaction.editReply("❌ The AI oracle is unavailable. Try again in a moment.");
    return;
  }

  if (loreEntries.length === 0) {
    await interaction.editReply("❌ The AI couldn't generate lore. Their legend defies comprehension.");
    return;
  }

  // Upsert member record
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

  // Save all generated entries
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

  const embed = new EmbedBuilder()
    .setColor(Colors.Purple)
    .setTitle(`✨ AI Lore Generated for ${target.displayName}`)
    .setThumbnail(target.displayAvatarURL())
    .setDescription(
      saved
        .map((entry, i) => `**${i + 1}.** 🤖 *[auto]* ${entry.content}\n> ID: \`${entry.id}\``)
        .join("\n\n"),
    )
    .setFooter({
      text: `Based on ${allMessages.length} messages · Use /lore @${target.username} to see full legend`,
    });

  await interaction.editReply({ content: "", embeds: [embed] });
}
