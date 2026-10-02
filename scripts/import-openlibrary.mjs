import fs from "node:fs/promises";
import path from "node:path";

const LIMIT = Math.max(1, Math.min(1000, Number(process.env.OPENLIBRARY_LIMIT || 500)));
const OUT = process.env.OPENLIBRARY_OUT || "content/public-sources/openlibrary-books.json";
const queries = (process.env.OPENLIBRARY_QUERIES || "classic literature,philosophy,psychology,science,history,education,business,spirituality")
  .split(",").map(s => s.trim()).filter(Boolean);

const records = new Map();
const clean = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

for (const q of queries) {
  const remaining = Math.max(1, Math.floor(LIMIT / queries.length));
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(remaining));
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,subject,language,cover_i,edition_key");
  let data=null, lastStatus=0;
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const res=await fetch(url,{headers:{"User-Agent":"Kurdish-Library/2 (open-book metadata importer)"}});
      lastStatus=res.status;
      if(res.ok){data=await res.json();break;}
    }catch{}
    await new Promise(r=>setTimeout(r,attempt*1500));
  }
  if(!data){console.warn(`Open Library query failed after retries: ${q} (HTTP ${lastStatus})`);continue;}

  for (const d of data.docs || []) {
    const key = clean(d.key);
    if (!key || !clean(d.title)) continue;
    records.set(key, {
      id: `ol-${key.split("/").pop().toLowerCase()}`,
      title: clean(d.title),
      author: clean((d.author_name || []).join(", ")) || "Unknown",
      category: clean((d.subject || [q])[0]) || q,
      language: clean((d.language || ["eng"])[0]) || "eng",
      format: "unknown",
      coverPath: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
      tags: (d.subject || []).slice(0, 8).map(clean).filter(Boolean),
      addedAt: Date.now(),
      source: "bundle",
      sourceUrl: `https://openlibrary.org${key}`,
      firstPublishYear: d.first_publish_year || undefined,
      editionKeys: (d.edition_key || []).slice(0, 5)
    });
  }
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify([...records.values()], null, 2) + "\n", "utf8");
console.log(`Imported ${records.size} Open Library metadata records -> ${OUT}`);
