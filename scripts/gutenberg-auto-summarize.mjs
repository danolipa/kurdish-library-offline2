import fs from "node:fs/promises";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const BOOKS_PER_RUN = Math.max(1, Number(process.env.BOOKS_PER_RUN || 5));
const MIN_WORDS = Math.max(1501, Number(process.env.MIN_WORDS || 1550));
const MAX_TEXT_CHARS = Math.max(50000, Number(process.env.MAX_TEXT_CHARS || 900000));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required. Add it as a GitHub Actions repository secret; never hard-code API keys.");

async function readJson(path, fallback) { try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; } }
function wordCount(s) { return s.trim().split(/\s+/u).filter(Boolean).length; }
function extractOutputText(json) {
  if (typeof json.output_text === "string") return json.output_text.trim();
  const parts = [];
  for (const item of (json.output || [])) for (const c of (item.content || [])) if (typeof c.text === "string") parts.push(c.text);
  return parts.join("\n").trim();
}
async function fetchText(id) {
  const urls = [
    "https://www.gutenberg.org/cache/epub/" + id + "/pg" + id + ".txt",
    "https://www.gutenberg.org/files/" + id + "/" + id + "-8.txt",
    "https://www.gutenberg.org/files/" + id + "/" + id + ".txt"
  ];
  for (const url of urls) {
    const r = await fetch(url, { headers: { "User-Agent": "Kurdish-Library-Gutenberg-Worker/1.0" } });
    if (r.ok) return (await r.text()).slice(0, MAX_TEXT_CHARS);
  }
  throw new Error("Could not fetch Gutenberg text for #" + id);
}
async function callOpenAI(input, instructions, maxOutputTokens) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, store: false, instructions, input, max_output_tokens: maxOutputTokens })
  });
  const body = await res.json();
  if (!res.ok) throw new Error("OpenAI API " + res.status + ": " + JSON.stringify(body).slice(0, 2000));
  return extractOutputText(body);
}
const queuePath = "content/gutenberg/summary-queue.json";
const queue = await readJson(queuePath, { minimumSummaryWords: MIN_WORDS, books: [] });
const generatedDir = "content/gutenberg/generated";
await fs.mkdir(generatedDir, { recursive: true });
let processed = 0;
for (const book of queue.books) {
  if (processed >= BOOKS_PER_RUN) break;
  if (book.status !== "queued") continue;
  try {
    book.status = "processing";
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
    const sourceText = await fetchText(book.gutenbergId);
    const instructions = [
      "You are the editorial summarizer for Kurdish Library.",
      "Write ONLY a detailed, natural Central Kurdish (Sorani) summary in Unicode Kurdish script.",
      "The summary MUST contain more than " + MIN_WORDS + " whitespace-separated words.",
      "Do not translate the whole book. Summarize it faithfully.",
      "Preserve major plot events, characters, arguments, structure, themes, important examples, and conclusions when present.",
      "Do not invent facts, scenes, quotations, chapter events, or interpretations not grounded in the source text.",
      "Use clear headings when useful. Do not include English metadata or commentary about being an AI."
    ].join("\n");
    let summary = await callOpenAI(
      "Book metadata:\nTitle: " + book.title + "\nAuthor(s): " + book.authors + "\nGutenberg ID: " + book.gutenbergId + "\n\nSOURCE TEXT:\n" + sourceText,
      instructions, 6500
    );
    if (wordCount(summary) < MIN_WORDS) summary = await callOpenAI(
      "Expand this Sorani summary so it is strictly longer than " + MIN_WORDS + " words while preserving factual accuracy. Add only grounded detail from the source text.\n\nCURRENT SUMMARY:\n" + summary + "\n\nSOURCE TEXT:\n" + sourceText,
      instructions, 7500
    );
    const count = wordCount(summary);
    if (count < MIN_WORDS) throw new Error("Generated summary was only " + count + " words");
    const result = {
      id: "gutenberg-" + book.gutenbergId, bookId: "gutenberg-" + book.gutenbergId,
      title: book.title, textKu: summary, wordCount: count, source: "Project Gutenberg",
      sourceUrl: book.sourceUrl, rights: book.rights, updatedAt: new Date().toISOString()
    };
    await fs.writeFile(generatedDir + "/gutenberg-" + book.gutenbergId + ".json", JSON.stringify(result, null, 2) + "\n");
    book.status = "complete"; book.summaryKu = summary; book.summaryWordCount = count; book.updatedAt = result.updatedAt; delete book.lastError;
    processed++;
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
    console.log("Completed #" + book.gutenbergId + ": " + count + " words");
  } catch (error) {
    book.status = "queued"; book.lastError = String(error?.message || error);
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
    console.error("Failed #" + book.gutenbergId + ": " + book.lastError);
  }
}
console.log("Processed " + processed + " Gutenberg books this run.");