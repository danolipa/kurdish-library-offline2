import fs from "node:fs/promises";

const input="content/open-sources/imported-summaries.json";
const translated="content/open-sources/translated-summaries.json";
const output="src/data/summaries.json";

const incoming=JSON.parse(await fs.readFile(input,"utf8"));
let translatedRows=[];
try{translatedRows=JSON.parse(await fs.readFile(translated,"utf8"))}catch{}

const map=new Map();
try{
  const existing=JSON.parse(await fs.readFile(output,"utf8"));
  for(const x of existing) map.set(x.id,x);
}catch{}

for(const x of incoming){
  if(!x?.id) continue;
  const old=map.get(x.id);
  const textKu=x.textKu||x.summaryKu||old?.textKu||"";
  if(!textKu) continue;
  map.set(x.id,{
    ...old,
    ...x,
    textKu,
    wordCount:x.wordCount||old?.wordCount||textKu.split(/\s+/).filter(Boolean).length
  });
}

for(const x of translatedRows){
  if(!x?.id || !x.textKu) continue;
  const old=map.get(x.id);
  map.set(x.id,{
    ...old,
    ...x,
    textKu:x.textKu,
    wordCount:x.wordCount||x.textKu.split(/\s+/).filter(Boolean).length
  });
}

const merged=[...map.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title)));
await fs.writeFile(output,JSON.stringify(merged,null,2)+"\n","utf8");
console.log("Bundled "+merged.length+" translated/curated offline summaries; skipped untranslated source records.");
