import fs from "node:fs/promises";

const input = "content/external/squality-plot.json";
const output = "content/open-sources/imported-summaries.json";

const rows = JSON.parse(await fs.readFile(input, "utf8"));
let existing = [];
try { existing = JSON.parse(await fs.readFile(output, "utf8")); } catch {}

const map = new Map(existing.map(x => [x.id, x]));
for (const row of rows) {
  map.set(row.id, {
    id: row.id,
    title: row.title || "Untitled story",
    author: "",
    category: "Short story",
    language: "en",
    textOriginal: row.sourceTextEn,
    textKu: "",
    source: row.source,
    sourceUrl: row.sourceUrl,
    rights: row.license,
    rightsNote: row.rightsNote,
    gutenbergId: row.gutenbergId,
    updatedAt: row.importedAt
  });
}
await fs.mkdir("content/open-sources", { recursive: true });
await fs.writeFile(output, JSON.stringify([...map.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title))), null, 2) + "\n");
console.log("Merged SQuALITY records: " + rows.length + "; total open-source records: " + map.size);
