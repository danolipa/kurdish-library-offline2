import fs from "node:fs/promises";
import path from "node:path";

const source="src/data/summaries.json";
const outDir="public/data/summaries";
const chunkSize=Math.max(50,Number(process.env.SUMMARY_PACK_SIZE||"250"));

const raw=await fs.readFile(source,"utf8");
const rows=JSON.parse(raw);
if(!Array.isArray(rows)) throw new Error("src/data/summaries.json must contain an array");

await fs.rm(outDir,{recursive:true,force:true});
await fs.mkdir(outDir,{recursive:true});

const packs=[];
for(let i=0;i<rows.length;i+=chunkSize){
  const items=rows.slice(i,i+chunkSize);
  const number=String(packs.length+1).padStart(4,"0");
  const file=`pack-${number}.json`;
  await fs.writeFile(path.join(outDir,file),JSON.stringify(items));
  packs.push({file,count:items.length,firstId:items[0]?.id||"",lastId:items.at(-1)?.id||""});
}
const manifest={
  version:1,
  generatedAt:new Date().toISOString(),
  total:rows.length,
  packSize:chunkSize,
  packs
};
await fs.writeFile(path.join(outDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(`Built ${packs.length} offline summary packs for ${rows.length} summaries.`);
