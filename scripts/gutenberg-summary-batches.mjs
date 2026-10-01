import fs from "node:fs/promises";

const batchSize = Number(process.env.BATCH_SIZE || 25);
const input = JSON.parse(await fs.readFile("content/gutenberg/summary-queue.json", "utf8"));
const pending = input.books.filter(x => x.status === "queued");
const batch = pending.slice(0, batchSize).map(x => ({
  gutenbergId: x.gutenbergId,
  title: x.title,
  authors: x.authors,
  language: x.language,
  sourceUrl: x.sourceUrl,
  minimumWords: input.minimumSummaryWords,
  instruction: "Create a detailed Central Kurdish (Sorani) summary of more than 1500 words. Preserve the book's main arguments, narrative/plot, characters where relevant, important concepts, structure, themes, examples, and practical lessons. Do not invent content."
}));
await fs.mkdir("content/gutenberg/batches", { recursive: true });
const name = `batch-${String(Date.now())}.json`;
await fs.writeFile(`content/gutenberg/batches/${name}`, JSON.stringify(batch, null, 2));
console.log(`Prepared ${batch.length} books in ${name}.`);
