import fs from "node:fs/promises";

const queue=JSON.parse(await fs.readFile("content/external/cmu/summary-queue.json","utf8"));
const path="src/data/library.json";
const existing=JSON.parse(await fs.readFile(path,"utf8"));
const map=new Map(existing.map(x=>[x.id,x]));
for(const x of queue.items||[]) {
  if(!x.id||!x.title) continue;
  const old=map.get(x.id);
  map.set(x.id,{
    ...(old||{}),
    id:x.id,
    title:x.title,
    author:x.author||old?.author||"Unknown",
    category:(x.genres||[]).join(", ")||old?.category||"Literature",
    language:old?.language||"eng",
    format:old?.format||"unknown",
    tags:x.genres?.length?x.genres:(old?.tags||[]),
    addedAt:old?.addedAt||0,
    source:"bundle",
    sourceUrl:x.sourceUrl,
    summaryKu:old?.summaryKu||"",
    summary:old?.summary||"",
    rights:x.license,
    metadata:{...(old?.metadata||{}),wikipediaId:x.wikiId,freebaseId:x.freebaseId,publicationDate:x.publishDate||""}
  });
}
const merged=[...map.values()];
await fs.writeFile(path,JSON.stringify(merged,null,2)+"\n","utf8");
console.log("Merged "+(queue.items?.length||0)+" CMU book records; library now contains "+merged.length+" books.");
