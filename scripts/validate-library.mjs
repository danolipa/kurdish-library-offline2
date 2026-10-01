import fs from "node:fs";
import path from "node:path";

const root=process.argv[2]||"public/library/books";
const manifest=process.argv[3]||"src/data/library.json";
const allowed=new Set(["pdf","epub","txt","html","htm"]);
const seen=new Set(); const errors=[]; const rows=[];

function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const name of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,name.name);
    if(name.isDirectory()) walk(full);
    else {
      const ext=path.extname(name.name).slice(1).toLowerCase();
      if(!allowed.has(ext)) continue;
      const rel=path.relative("public",full).replaceAll(path.sep,"/");
      if(seen.has(rel)) errors.push("Duplicate path: "+rel);
      seen.add(rel);
      rows.push({path:rel,format:ext==="htm"?"html":ext,sizeBytes:fs.statSync(full).size});
    }
  }
}
walk(root);

if(fs.existsSync(manifest)){
  const data=JSON.parse(fs.readFileSync(manifest,"utf8"));
  if(!Array.isArray(data)) errors.push("library.json must be an array");
  else for(const b of data){
    if(!b.id||!b.title||!b.format) errors.push("Book missing id/title/format: "+JSON.stringify(b).slice(0,180));
    if(b.format&&!allowed.has(b.format)) errors.push("Unsupported format for "+(b.id||"unknown")+": "+b.format);
  }
}
console.log(JSON.stringify({files:rows.length,manifestExists:fs.existsSync(manifest),errors},null,2));
if(errors.length) process.exit(1);
