import fs from "node:fs/promises";
import path from "node:path";
const root="public/books";
const out="public/assets-manifest.json";
const assets=[];
async function walk(dir){
  try{
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) await walk(full);
      else assets.push(full.replaceAll("\\","/"));
    }
  }catch{}
}
await walk(root);
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),count:assets.length,assets},null,2));
console.log("Asset manifest:",assets.length);
