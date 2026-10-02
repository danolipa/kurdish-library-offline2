import fs from "node:fs/promises";

const path="src/data/library.json";
const existing=JSON.parse(await fs.readFile(path,"utf8"));
const map=new Map(existing.map(x=>[x.id,x]));

let sourceRows=[];
try{
  const all=JSON.parse(await fs.readFile("content/open-sources/imported-summaries.json","utf8"));
  sourceRows=all.filter(x=>String(x.id||"").startsWith("cmu-"));
}catch{}

const queuePath="content/external/cmu/summary-queue.json";
try{
  const queue=JSON.parse(await fs.readFile(queuePath,"utf8"));
  for(const x of queue.items||[]) sourceRows.push({
    id:x.id,title:x.title,author:x.author,category:(x.genres||[]).join(", "),
    tags:x.genres||[],source:x.source,sourceUrl:x.sourceUrl,rights:x.license,
    metadata:{wikipediaId:x.wikiId,freebaseId:x.freebaseId,publicationDate:x.publishDate||""}
  });
}catch{}

const unique=new Map(sourceRows.map(x=>[x.id,x]));
for(const x of unique.values()){
  if(!x.id||!x.title) continue;
  const old=map.get(x.id);
  map.set(x.id,{
    ...(old||{}),
    id:x.id,
    title:x.title,
    author:x.author||old?.author||"Unknown",
    category:x.category||old?.category||"Literature",
    language:old?.language||"eng",
    format:old?.format||"unknown",
    tags:x.tags?.length?x.tags:(old?.tags||[]),
    addedAt:old?.addedAt||0,
    source:"bundle",
    sourceUrl:x.sourceUrl||old?.sourceUrl,
    summaryKu:old?.summaryKu||x.textKu||"",
    summary:old?.summary||"",
    rights:x.rights||old?.rights,
    metadata:{...(old?.metadata||{}),...(x.metadata||{})}
  });
}
const merged=[...map.values()];
await fs.writeFile(path,JSON.stringify(merged,null,2)+"\n","utf8");
console.log("Synchronized "+unique.size+" CMU source records; library now contains "+merged.length+" books.");
