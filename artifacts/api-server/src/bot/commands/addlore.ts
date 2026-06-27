import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { db, loreEntriesTable, membersTable } from "@workspace/db";
import { gemini } from "../../lib/gemini";
import { logger } from "../../lib/logger";

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite"];

function shouldFallback(err: any): boolean {
  const msg = String(err?.message ?? err);
  const code = Number(err?.status ?? err?.code ?? 0);
  return (
    code === 429 ||
    code === 503 ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("resource_exhausted") ||
    msg.toLowerCase().includes("high demand") ||
    msg.toLowerCase().includes("unavailable")
  );
}

async function paraphraseLore(text: string, displayName: string): Promise<string | null> {
  const prompt = `Bạn là người viết lore huyền thoại cho server Discord. Hãy paraphrase câu sau về "${displayName}" sao cho hài hơn, phóng đại hơn và mang giọng điệu hào hùng, deadpan — như thể đây là một huyền thoại trong server. Giữ nguyên ý nghĩa gốc nhưng làm nó nghe epic và buồn cười hơn. Chỉ trả về đúng 1 câu paraphrase, không giải thích gì thêm, viết bằng tiếng Việt.

Câu gốc: "${text}"`;

  for (const model of MODELS) {
    try {
      const response = await gemini.models.generateContent({ model, contents: prompt });
      const result = (response.text ?? "").trim().replace(/^["']|["']$/g, "");
      if (result) return result;
    } catch (err: any) {
      if (shouldFallback(err)) {
        logger.warn({ model }, "Gemini model unavailable for paraphrase, trying next");
        continue;
      }
      logger.error({ err, model }, "Gemini paraphrase failed");
      return null;
    }
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName("addlore")
  .setDescription("Thêm một mục lore cho thành viên")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Thành viên cần thêm lore").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("text").setDescription("Nội dung lore").setRequired(true).setMaxLength(500),
  )
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Loại lore (mặc định: thủ công)")
      .addChoices(
        { name: "Thủ công", value: "manual" },
        { name: "Roast", value: "roast" },
        { name: "Sự kiện", value: "event" },
        { name: "Donate", value: "donation" },
        { name: "Chat", value: "chat" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "lệnh này chỉ dùng được trong server", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const text = interaction.options.getString("text", true);
  const category = interaction.options.getString("category") ?? "manual";

  await interaction.deferReply({ ephemeral: true });

  if (target.bot) {
    await interaction.editReply("bot không có lore, chúng không có linh hồn");
    return;
  }

  await interaction.editReply(`đang paraphrase lore cho **${target.displayName}**...`);

  const paraphrased = await paraphraseLore(text, target.displayName);
  const finalContent = paraphrased ?? text;

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
      content: finalContent,
      category,
      addedByDiscordId: interaction.user.id,
    })
    .returning();

  const lines = [
    `đã thêm lore cho **${target.displayName}** (id: ${entry!.id})`,
    `📝 gốc: *${text}*`,
    paraphrased
      ? `✨ paraphrase: *${paraphrased}*`
      : `⚠️ AI không paraphrase được, đã lưu nguyên bản.`,
  ];

  await interaction.editReply(lines.join("\n"));
}
