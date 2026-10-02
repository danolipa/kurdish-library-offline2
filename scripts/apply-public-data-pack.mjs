import fs from "node:fs/promises";

const packPath = process.env.PACK_IN || "content/public-sources/openlibrary-pack.json";
const libraryPath = process.env.LIBRARY_OUT || "src/data/library.json";

const pack = JSON.parse(await fs.readFile(packPath, "utf8"));
let existing = [];
try { existing = JSON.parse(await fs.readFile(libraryPath, "utf8")); } catch {}

const byId = new Map(existing.map(b => [b.id, b]));
for (const b of pack.books || []) {
  const old = byId.get(b.id);
  byId.set(b.id, old ? { ...old, ...b, addedAt: old.addedAt || b.addedAt || Date.now(), summaryKu: old.summaryKu || b.summaryKu || "" } : b);
}
const merged = [...byId.values()];
await fs.writeFile(libraryPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log(`Merged ${pack.books?.length || 0} public records; library now contains ${merged.length} books.`);
