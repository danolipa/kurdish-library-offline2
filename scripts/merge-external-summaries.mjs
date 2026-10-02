import fs from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const src=path.join(root,"content/external/squality-kurdish.json");
const out=path.join(root,"src/data/summaries.json");
const incoming=JSON.parse(await fs.readFile(src,"utf8"));
let existing=[];
try{existing=JSON.parse(await fs.readFile(out,"utf8"));}catch{}

const map=new Map(existing.map(x=>[x.id,x]));
for(const row of incoming){
  if(!row.summaryKu) continue;
  map.set(row.id,{
    id:row.id,
    bookId:"gutenberg-"+row.gutenbergId,
    title:row.title || ("Gutenberg #"+row.gutenbergId),
    textKu:row.summaryKu,
    textOriginal:row.sourceTextEn,
    wordCount:row.summaryKu.trim().split(/\s+/).length,
    source:row.source,
    sourceUrl:row.sourceUrl,
    rights:row.license+"; "+row.rightsNote,
    updatedAt:row.translatedAt
  });
}
await fs.writeFile(out,JSON.stringify([...map.values()],null,2)+"\n","utf8");
console.log("Merged "+incoming.length+" external summaries; total "+map.size);
