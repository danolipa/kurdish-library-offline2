import fs from "node:fs/promises";
import path from "node:path";

const key = process.env.GROQ_API_KEY;
if (!key) throw new Error("GROQ_API_KEY is required; keep it in GitHub Actions Secrets.");
const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const input = path.join(process.cwd(), "content/external/squality-plot.json");
const output = path.join(process.cwd(), "content/external/squality-kurdish.json");
const rows = JSON.parse(await fs.readFile(input, "utf8"));
const limit = Math.max(1, Number(process.env.EXTERNAL_LIMIT || 10));
const out = [];

for (const row of rows.slice(0, limit)) {
  const prompt = [
    "وەک وەرگێڕ و نووسەری پیشەیی سۆرانی کار بکە.",
    "ئەم پوختەی ئینگلیزییە بکە بە کوردیی ناوەندی (سۆرانی)ی سروشتی و ڕوون.",
    "واتا و ڕووداوەکان مەگۆڕە و هیچ زانیارییەکی خۆت زیاد مەکە.",
    "پوختەکە بە شێوەیەکی زانیاری‌دار فراوان بکە تا نزیکەی 1600-1800 وشە بێت، بەبێ دروستکردنی ڕووداوی نوێ.",
    "تەنها دەقی کۆتایی سۆرانی بنووسە.",
    "",
    "پوختەی سەرچاوە:",
    row.sourceTextEn
  ].join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 8000,
      messages: [
        { role: "system", content: "You produce accurate Central Kurdish (Sorani) literary summaries. Do not invent facts." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!res.ok) throw new Error("Groq request failed: " + res.status + " " + await res.text());
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty translation response");
  out.push({
    ...row,
    summaryKu: text,
    translatedAt: new Date().toISOString(),
    targetLanguage: "ckb"
  });
  console.log("Translated " + row.id);
}
await fs.writeFile(output, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log("Wrote " + out.length + " Kurdish summaries -> " + output);
