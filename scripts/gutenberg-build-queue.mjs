import fs from "node:fs/promises";

const LIMIT = Number(process.env.LIMIT || 10000);
const catalogUrl = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift().map(x => x.trim());
  return rows.map(r => Object.fromEntries(header.map((h,i)=>[h,(r[i] ?? "").trim()])));
}

const csv = await (await fetch(catalogUrl)).text();
const catalog = parseCsv(csv);
const candidates = catalog
  .filter(x => x["Type"] === "Text")
  .sort((a,b) => Number(a["Book ID"] || 0) - Number(b["Book ID"] || 0))
  .slice(0, LIMIT)
  .map((x, i) => ({
    order: i + 1,
    gutenbergId: Number(x["Book ID"]),
    title: x["Title"],
    authors: x["Authors"],
    subjects: x["Subjects"],
    bookshelves: x["Bookshelves"],
    language: x["Language"],
    issued: x["LoCC"],
    rights: "Project Gutenberg free ebook; verify applicable territorial copyright before redistribution",
    sourceUrl: `https://www.gutenberg.org/ebooks/${x["Book ID"]}`,
    status: "queued",
    summaryKu: "",
    summaryWordCount: 0
  }));

await fs.mkdir("content/gutenberg", { recursive: true });
await fs.writeFile("content/gutenberg/summary-queue.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  targetCount: candidates.length,
  minimumSummaryWords: 1500,
  books: candidates
}, null, 2));

console.log(`Created queue with ${candidates.length} Gutenberg books.`);
