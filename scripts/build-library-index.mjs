import fs from "node:fs";
import path from "node:path";
const root=process.argv[2]||"public/library/books";
const output=process.argv[3]||"src/data/library.json";
const allowed=new Set(["pdf","epub","txt","html","htm"]);
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const full=path.join(dir,name);const st=fs.statSync(full);if(st.isDirectory())walk(full);else{const ext=path.extname(name).slice(1).toLowerCase();if(allowed.has(ext))files.push({name,full,ext,size:st.size});}}}
walk(root);
const books=files.map((f,i)=>({id:"bundle-"+String(i+1).padStart(5,"0"),title:path.basename(f.name,path.extname(f.name)),author:"نادیار",category:"هاوردەکراو",language:"کوردی",format:f.ext==="htm"?"html":f.ext,filePath:path.relative("public",f.full).replaceAll(path.sep,"/"),sizeBytes:f.size,addedAt:Date.now()+i,source:"bundle"}));
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(books,null,2)+"\n");
console.log("Indexed "+books.length+" books.");