import fs from "node:fs/promises";
import path from "node:path";

const roots=["src/data","public/data"];
const out="src/data/build-metadata.json";
const filesFound=[];
for(const root of roots){
  try{
    const entries=await fs.readdir(root,{recursive:true});
    for(const entry of entries){
      if(typeof entry==="string" && /\.(json|txt|epub|pdf)$/i.test(entry)) filesFound.push(path.posix.join(root.replaceAll("\\","/"),entry));
    }
  }catch{}
}
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),assets:filesFound.sort()},null,2));
console.log("Build metadata:",filesFound.length,"assets");
