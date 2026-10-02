import fs from "node:fs/promises";
const q=JSON.parse(await fs.readFile("content/external/cmu/summary-queue.json","utf8"));
const input="content/open-sources/imported-summaries.json";let rows=[];try{rows=JSON.parse(await fs.readFile(input,"utf8"))}catch{}
const map=new Map(rows.map(x=>[x.id,x]));
for(const x of q.items||[]) map.set(x.id,{id:x.id,bookId:x.id,title:x.title,author:x.author||"Unknown",textKu:x.summaryKu||"",textOriginal:x.textOriginal,wordCount:x.summaryWordCount||0,source:x.source,sourceUrl:x.sourceUrl,rights:x.license,category:(x.genres||[]).join(", ")||"General",tags:x.genres||[],updatedAt:new Date().toISOString(),metadata:{wikipediaId:x.wikiId,freebaseId:x.freebaseId,publicationDate:x.publishDate||""}});
await fs.mkdir("content/open-sources",{recursive:true});await fs.writeFile(input,JSON.stringify([...map.values()],null,2)+"\n");console.log("Added "+(q.items||[]).length+" CMU records; total "+map.size);