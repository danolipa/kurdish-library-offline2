import fs from "node:fs/promises";
import path from "node:path";

const input="content/open-sources/imported-summaries.json";
const outDir="public/data/source-summaries";
const packSize=Math.max(50,Number(process.env.SOURCE_SUMMARY_PACK_SIZE||"100"));
const rows=JSON.parse(await fs.readFile(input,"utf8"));
if(!Array.isArray(rows)) throw new Error("Source summary input must be an array");
const usable=rows.filter(x=>x?.id&&x?.textOriginal);
await fs.rm(outDir,{recursive:true,force:true});
await fs.mkdir(outDir,{recursive:true});
const packs=[];
for(let i=0;i<usable.length;i+=packSize){
  const items=usable.slice(i,i+packSize);
  const file="pack-"+String(packs.length+1).padStart(4,"0")+".json";
  await fs.writeFile(path.join(outDir,file),JSON.stringify(items));
  packs.push({file,count:items.length,ids:items.map(x=>x.id)});
}
const manifest={version:1,generatedAt:new Date().toISOString(),total:usable.length,packSize,packs};
await fs.writeFile(path.join(outDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log("Built "+packs.length+" source-summary packs for "+usable.length+" source summaries.");
