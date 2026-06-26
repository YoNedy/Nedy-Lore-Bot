import { db, loreEntriesTable } from "@workspace/db";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";

const gemini = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"]! });

async function translateToVietnamese(texts: string[]): Promise<string[]> {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Dịch các mục lore sau sang tiếng Việt. Giữ nguyên giọng điệu hài hước, hào hùng, deadpan. Chỉ trả về mảng JSON gồm ${texts.length} chuỗi đã dịch, không có gì thêm.\n\n${numbered}`,
  });

  const raw = response.text ?? "[]";
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array in response");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`Expected ${texts.length} entries, got ${parsed.length}`);
  }
  return parsed;
}

async function main() {
  const entries = await db.select().from(loreEntriesTable);

  if (entries.length === 0) {
    console.log("No lore entries found.");
    return;
  }

  console.log(`Found ${entries.length} lore entries. Translating in batches...`);

  // Translate in batches of 10 to stay within prompt limits
  const BATCH = 10;
  let updated = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    console.log(`Translating batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(entries.length / BATCH)}...`);

    const translated = await translateToVietnamese(batch.map((e) => e.content));

    for (let j = 0; j < batch.length; j++) {
      await db
        .update(loreEntriesTable)
        .set({ content: translated[j] })
        .where(eq(loreEntriesTable.id, batch[j]!.id));
      updated++;
    }

    // Small delay to avoid rate limiting
    if (i + BATCH < entries.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`Done. Translated ${updated} lore entries to Vietnamese.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
