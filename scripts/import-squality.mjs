import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "content/external/squality-plot.json");
const SOURCES = [
  "https://huggingface.co/datasets/pszemraj/SQuALITY-v1.3/resolve/main/train.jsonl",
  "https://huggingface.co/datasets/pszemraj/SQuALITY-v1.3/resolve/main/dev.jsonl",
  "https://huggingface.co/datasets/pszemraj/SQuALITY-v1.3/resolve/main/test.jsonl"
];

function clean(s="") {
  return String(s).replace(/\s+/g, " ").trim();
}

const rows = new Map();
for (const url of SOURCES) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch " + url + ": " + res.status);
  const text = await res.text();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const story = JSON.parse(line);
    const meta = story.metadata || {};
    const questions = Array.isArray(story.questions) ? story.questions : [];
    const plot = questions.find(q => /plot/i.test(q.question_text || "")) || questions[0];
    if (!plot) continue;
    const responses = (plot.responses || []).map(r => clean(r.response_text)).filter(Boolean);
    if (!responses.length) continue;
    const id = String(meta.gutenberg_id ?? meta.uid ?? meta.gem_id ?? rows.size);
    const best = [...responses].sort((a,b) => b.length - a.length)[0];
    rows.set(id, {
      id: "squality-" + id,
      gutenbergId: Number(meta.gutenberg_id) || undefined,
      title: clean(meta.title || ""),
      question: clean(plot.question_text || "What is the plot of the story?"),
      sourceTextEn: best,
      alternativesEn: responses,
      source: "SQuALITY v1.3",
      sourceUrl: "https://huggingface.co/datasets/pszemraj/SQuALITY-v1.3",
      license: "CC BY 4.0",
      rightsNote: "Dataset material is licensed; underlying Gutenberg work rights must be checked separately.",
      importedAt: new Date().toISOString()
    });
  }
}
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify([...rows.values()], null, 2) + "\n", "utf8");
console.log("Imported " + rows.size + " SQuALITY records -> " + OUT);
