import fs from "node:fs/promises";
import path from "node:path";

const input = process.env.OPENLIBRARY_OUT || "content/public-sources/openlibrary-books.json";
const out = process.env.PACK_OUT || "content/public-sources/openlibrary-pack.json";
const books = JSON.parse(await fs.readFile(input, "utf8"));

const normalized = books.map(b => ({
  id: b.id, title: b.title, author: b.author, category: b.category,
  language: b.language, format: b.format || "unknown", coverPath: b.coverPath,
  tags: b.tags, addedAt: b.addedAt || Date.now(), source: "bundle",
  sourceUrl: b.sourceUrl, summaryKu: "", summary: "",
  rights: "Metadata derived from Open Library; attribution required under applicable Open Database licensing."
}));

await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify({
  version: 1, generatedAt: new Date().toISOString(), source: "Open Library",
  attribution: "Data derived from Open Library (openlibrary.org)",
  books: normalized, summaries: [], quotes: [], authors: []
}, null, 2) + "\n", "utf8");
console.log(`Built public data pack with ${normalized.length} books -> ${out}`);
