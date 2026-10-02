import fs from "node:fs/promises";
const OUT="content/open-sources/cmu-book-summaries.json";
const LIMIT=Math.max(1,Number(process.env.CMU_LIMIT||"1000"));
const r=await fetch("https://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz",{headers:{"user-agent":"Kurdish-Library/2 CMU importer"}});
if(!r.ok)throw new Error("CMU download failed: "+r.status);
const buf=Buffer.from(await r.arrayBuffer());
const zlib=await import("node:zlib"); const tar=zlib.gunzipSync(buf);
let pos=0, text="";
while(pos+512<=tar.length){const h=tar.subarray(pos,pos+512);if(h.every(x=>x===0))break;const name=h.subarray(0,100).toString("utf8").replace(/\0.*$/,"");const size=parseInt(h.subarray(124,136).toString("utf8").replace(/\0.*$/,"").trim()||"0",8)||0;const body=tar.subarray(pos+512,pos+512+size);if(name.endsWith("booksummaries.txt"))text=body.toString("utf8");pos+=512+Math.ceil(size/512)*512;}
if(!text)throw new Error("booksummaries.txt not found");
const rows=text.split(/\r?\n/).filter(Boolean).slice(0,LIMIT),out=[];
for(const line of rows){const p=line.split("\t");if(p.length<7)continue;let genres={};try{genres=JSON.parse(p[5]||"{}")}catch{};const title=p[2]?.trim();if(!title||!p[6]?.trim())continue;const id="cmu-"+p[0];out.push({id,bookId:id,title,author:p[3]?.trim()||"Unknown",textKu:"",textOriginal:p[6].trim(),wordCount:0,source:"CMU Book Summary Dataset",sourceUrl:"https://www.cs.cmu.edu/~dbamman/booksummaries.html",rights:"CC BY-SA; retain attribution and ShareAlike terms",category:Object.values(genres).slice(0,3).join(", ")||"General",tags:Object.values(genres).slice(0,10),updatedAt:new Date().toISOString(),metadata:{wikipediaId:p[0],freebaseId:p[1],publicationDate:p[4]||""}})}
await fs.mkdir("content/open-sources",{recursive:true});await fs.writeFile(OUT,JSON.stringify(out,null,2)+"\n");console.log("Imported "+out.length+" CMU book summaries.");