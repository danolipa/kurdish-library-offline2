import fs from "node:fs/promises";
const q=JSON.parse(await fs.readFile("content/external/cmu/summary-queue.json","utf8").catch(()=>"{\"items\":[]}"));
const out="src/data/summaries.json", existing=JSON.parse(await fs.readFile(out,"utf8").catch(()=>"[]"));
const map=new Map(existing.map(x=>[x.id,x]));
for(const x of q.items||[])if(x.summaryKu&&Number(x.summaryWordCount||0)>=1500)map.set(x.id,{id:x.id,bookId:x.id,title:x.title,textKu:x.summaryKu,textOriginal:x.textOriginal,wordCount:x.summaryWordCount,source:x.source,sourceUrl:x.sourceUrl,rights:x.license,updatedAt:new Date().toISOString()});
await fs.writeFile(out,JSON.stringify([...map.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id))),null,2)+"\n");
console.log(`Bundled ${map.size} summaries.`);
