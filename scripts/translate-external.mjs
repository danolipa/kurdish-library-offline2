import fs from "node:fs/promises";
import path from "node:path";

const key = process.env.GROQ_API_KEY;
if (!key) throw new Error("GROQ_API_KEY is required; keep it in GitHub Actions Secrets.");
const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const input = path.join(process.cwd(), process.env.TRANSLATE_INPUT || "content/open-sources/imported-summaries.json");
const output = path.join(process.cwd(), process.env.TRANSLATE_OUTPUT || "content/open-sources/translated-summaries.json");
const rows = JSON.parse(await fs.readFile(input, "utf8"));
let existing=[]; try { existing=JSON.parse(await fs.readFile(output,"utf8")); } catch {}
const done=new Map(existing.map(x=>[x.id,x]));
const limit = Math.max(1, Number(process.env.EXTERNAL_LIMIT || 10));
const out = [];

for (const row of rows.filter(x=>!String(done.get(x.id)?.textKu||"").trim()).slice(0, limit)) {
  const prompt = [
    "وەک وەرگێڕ و نووسەری پیشەیی سۆرانی کار بکە.",
    "ئەم پوختەی ئینگلیزییە بکە بە کوردیی ناوەندی (سۆرانی)ی سروشتی و ڕوون.",
    "واتا و ڕووداوەکان مەگۆڕە و هیچ زانیارییەکی خۆت زیاد مەکە.",
    "پوختەکە بە شێوەیەکی زانیاری‌دار فراوان بکە تا نزیکەی 1600-1800 وشە بێت، بەبێ دروستکردنی ڕووداوی نوێ.",
    "تەنها دەقی کۆتایی سۆرانی بنووسە.",
    "",
    "پوختەی سەرچاوە:",
    row.textOriginal||row.sourceTextEn||""
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
  done.set(row.id,{
    ...row,
    textKu: text,
    summaryKu: text,
    translatedAt: new Date().toISOString(),
    targetLanguage: "ckb"
  });
  out.push(done.get(row.id));
  console.log("Translated " + row.id);
}
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output, JSON.stringify([...done.values()], null, 2) + "\n", "utf8");
console.log("Wrote " + out.length + " Kurdish summaries -> " + output);
