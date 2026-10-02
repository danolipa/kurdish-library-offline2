import fs from "node:fs/promises";
const input="content/open-sources/imported-summaries.json",translated="content/open-sources/translated-summaries.json",output="src/data/summaries.json";
const incoming=JSON.parse(await fs.readFile(input,"utf8"));let translatedRows=[];try{translatedRows=JSON.parse(await fs.readFile(translated,"utf8"))}catch{}
const map=new Map();
try{const existing=JSON.parse(await fs.readFile(output,"utf8"));for(const x of existing)map.set(x.id,x)}catch{}
for(const x of incoming){const old=map.get(x.id);map.set(x.id,{...old,...x,textKu:x.textKu||old?.textKu||"",wordCount:x.wordCount||old?.wordCount||0})}
for(const x of translatedRows){const old=map.get(x.id);if(old)map.set(x.id,{...old,...x,textKu:x.textKu||old?.textKu||""});}
const merged=[...map.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title)));await fs.writeFile(output,JSON.stringify(merged,null,2)+"\n","utf8");console.log("Merged open-source records: "+incoming.length+" imported, "+translatedRows.length+" translated, total "+merged.length);