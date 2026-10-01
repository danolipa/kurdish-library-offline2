import fs from "node:fs/promises";

const dir = "content/gutenberg/generated";
const out = "src/data/summaries.json";
let files = [];
try { files = (await fs.readdir(dir)).filter(f => f.endsWith(".json")).sort(); } catch {}
const summaries = [];
for (const file of files) {
  const item = JSON.parse(await fs.readFile(dir + "/" + file, "utf8"));
  if (item?.textKu && Number(item.wordCount || 0) > 1500) summaries.push(item);
}
summaries.sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
await fs.writeFile(out, JSON.stringify(summaries, null, 2) + "\n");
console.log("Rebuilt " + out + " with " + summaries.length + " summaries.");
