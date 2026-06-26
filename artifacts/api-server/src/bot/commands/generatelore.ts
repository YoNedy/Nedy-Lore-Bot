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
  .setDescription("Quét tin nhắn và tự động tạo lore cho thành viên bằng AI")
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần tạo lore").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("entries")
      .setDescription("Số mục lore cần tạo (mặc định: 3, tối đa: 5)")
      .setMinValue(1)
      .setMaxValue(5),
  );

const CHANNEL_TIMEOUT_MS = 8_000;

/** Fetch up to `limit` messages from one channel with a hard timeout. */
async function fetchUserMessages(
  channel: TextChannel,
  userId: string,
  limit: number,
): Promise<string[]> {
  const results: string[] = [];
  let lastId: string | undefined;
  const deadline = Date.now() + CHANNEL_TIMEOUT_MS;

  while (results.length < limit && Date.now() < deadline) {
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
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const count = interaction.options.getInteger("entries") ?? 3;

  if (target.bot) {
    await interaction.reply({ content: "bot không có lore", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  await interaction.editReply(`đang quét tin nhắn của ${target.displayName}...`);

  const guild = interaction.guild!;
  const textChannels = guild.channels.cache
    .filter((ch) => ch instanceof TextChannel && ch.viewable)
    .map((ch) => ch as TextChannel);

  const sampled = textChannels.slice(0, 20);

  const results = await Promise.allSettled(
    sampled.map((channel) => fetchUserMessages(channel, target.id, 40)),
  );

  const allMessages: string[] = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  if (allMessages.length === 0) {
    await interaction.editReply(`không tìm thấy tin nhắn nào của ${target.displayName}`);
    return;
  }

  await interaction.editReply(
    `tìm thấy ${allMessages.length} tin nhắn của ${target.displayName}, đang tạo lore...`,
  );

  const sample = allMessages.slice(0, 150);
  const messagesText = sample.map((m, i) => `${i + 1}. ${m}`).join("\n");

  let loreEntries: string[] = [];

  const prompt = `Bạn là một người viết lore huyền thoại cho server Discord. Dựa trên các tin nhắn của thành viên, hãy viết những mục lore ngắn, hài hước, phóng đại về họ — như thể họ là một nhân vật huyền thoại trong server. Mỗi mục 1-2 câu, hài hước, dựa trên nội dung thực tế từ tin nhắn của họ (chủ đề, cách nói chuyện, hành vi, sở thích). KHÔNG được ác ý. Viết bằng tiếng Việt theo giọng điệu hào hùng, deadpan.

Đây là ${sample.length} tin nhắn của thành viên "${target.displayName}":

${messagesText}

Viết chính xác ${count} mục lore về họ dựa trên các tin nhắn trên. Trả về CHỈ một mảng JSON gồm ${count} chuỗi, không có văn bản hay markdown thừa.`;

  const isQuotaError = (err: any): boolean => {
    const msg = String(err?.message ?? err);
    return (
      msg.includes("429") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("resource_exhausted")
    );
  };

  const parseResponse = (text: string): string[] => {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string").slice(0, count);
  };

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite"];
  let lastErr: any;

  for (const model of models) {
    try {
      const response = await gemini.models.generateContent({ model, contents: prompt });
      loreEntries = parseResponse(response.text ?? "[]");
      break;
    } catch (err: any) {
      lastErr = err;
      if (isQuotaError(err)) {
        logger.warn({ model }, "Gemini quota hit, trying next model");
        continue;
      }
      logger.error({ err, model }, "Gemini lore generation failed");
      await interaction.editReply("AI đang bận, thử lại sau.");
      return;
    }
  }

  if (loreEntries.length === 0 && lastErr) {
    logger.error({ err: lastErr }, "All Gemini models exhausted");
    if (isQuotaError(lastErr)) {
      await interaction.editReply(
        "❌ Gemini API đã hết quota hôm nay trên tất cả models. Thử lại vào ngày mai hoặc nâng cấp API key.",
      );
    } else {
      await interaction.editReply("AI đang bận, thử lại sau.");
    }
    return;
  }

  if (loreEntries.length === 0) {
    await interaction.editReply("AI không tạo được lore, huyền thoại của họ vượt ngoài tầm hiểu biết");
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
    `lore đã được tạo cho ${target.displayName}\n\n${lines.join("\n")}`,
  );
}
