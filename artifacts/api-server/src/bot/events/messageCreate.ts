import { Client, Message } from "discord.js";
import { db, membersTable, loreEntriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getMilestone } from "../milestones";
import { logger } from "../../lib/logger";
import { gemini } from "../../lib/gemini";

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

async function paraphraseMilestoneLore(
  templateLore: string,
  displayName: string,
): Promise<string> {
  const prompt = `Bạn là người viết lore huyền thoại cho server Discord. Hãy viết lại câu lore dưới đây về thành viên "${displayName}" sao cho hài hơn, phóng đại hơn và mang giọng điệu hào hùng deadpan — giống như một huyền thoại trong server. Giữ nguyên ý nghĩa milestone (số tin nhắn đạt được) nhưng làm nó nghe epic và buồn cười hơn. Đề cập tên "${displayName}" trong câu. Chỉ trả về đúng 1 câu, không giải thích gì thêm, viết bằng tiếng Việt.

Câu gốc: "${templateLore}"`;

  for (const model of MODELS) {
    try {
      const response = await gemini.models.generateContent({ model, contents: prompt });
      const result = (response.text ?? "").trim().replace(/^["']|["']$/g, "");
      if (result) return result;
    } catch (err: any) {
      if (shouldFallback(err)) {
        logger.warn({ model }, "Gemini unavailable for milestone paraphrase, trying next");
        continue;
      }
      logger.error({ err, model }, "Gemini milestone paraphrase failed");
      break;
    }
  }

  // Fallback: insert the member's name into the template lore
  return `${displayName} — ${templateLore}`;
}

export function registerMessageCreateEvent(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guildId) return;

    const discordId = message.author.id;
    const guildId = message.guildId;

    try {
      // Upsert member (guild-scoped) and increment message count atomically
      const result = await db
        .insert(membersTable)
        .values({
          discordId,
          guildId,
          username: message.author.username,
          displayName: message.member?.displayName ?? message.author.displayName,
          messageCount: 1,
        })
        .onConflictDoUpdate({
          target: [membersTable.discordId, membersTable.guildId],
          set: {
            username: message.author.username,
            displayName: message.member?.displayName ?? message.author.displayName,
            messageCount: sql`${membersTable.messageCount} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ messageCount: membersTable.messageCount });

      const newCount = result[0]?.messageCount ?? 1;
      const previousCount = newCount - 1;

      const milestone = getMilestone(previousCount, newCount);
      if (milestone) {
        const displayName = message.member?.displayName ?? message.author.displayName;
        const paraphrased = await paraphraseMilestoneLore(milestone.lore, displayName);

        await db.insert(loreEntriesTable).values({
          discordId,
          guildId,
          content: paraphrased,
          category: "chat",
          addedByDiscordId: null,
        });

        logger.info(
          { discordId, guildId, messageCount: newCount },
          "Milestone lore entry created",
        );

        // Announce in the channel where the milestone was hit
        try {
          if ("send" in message.channel) {
            await message.channel.send(
              `${displayName} vừa đạt **${newCount.toLocaleString("vi-VN")} tin nhắn** — ${paraphrased}`,
            );
          }
        } catch {
          // Channel may not allow bot messages; swallow silently
        }
      }
    } catch (err) {
      logger.error({ err, discordId, guildId }, "Error handling messageCreate for lore tracking");
    }
  });
}
