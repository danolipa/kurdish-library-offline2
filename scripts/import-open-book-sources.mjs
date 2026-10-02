import fs from "node:fs/promises";
import path from "node:path";
const OUT="content/open-sources/imported-summaries.json";
const UA="Kurdish-Library/2 open-book-source-importer";
async function json(url,options={}){const r=await fetch(url,{...options,headers:{"user-agent":UA,...(options.headers||{})}});if(!r.ok)throw new Error("HTTP "+r.status+" "+url);return r.json()}
function slug(s){return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90)}
async function booksForAgents(){
 const endpoint="https://booksforagents.com/mcp";let id=1;
 async function rpc(method,params={}){const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","accept":"application/json, text/event-stream","user-agent":UA},body:JSON.stringify({jsonrpc:"2.0",id:id++,method,params})});if(!r.ok)throw new Error("BFA MCP HTTP "+r.status);const t=await r.text();const line=t.split("\n").map(x=>x.trim()).map(x=>x.startsWith("data:")?x.slice(5).trim():x).find(x=>x.startsWith("{"));if(!line)throw new Error("BFA MCP returned no JSON");const m=JSON.parse(line);if(m.error)throw new Error(m.error.message||"MCP error");return m.result}
 try{await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"kurdish-library-importer",version:"1.0.0"}})}catch{}
 const tools=await rpc("tools/list");if(!tools.tools?.some(x=>x.name==="search_books"))throw new Error("search_books unavailable");
 async function call(name,args){const r=await rpc("tools/call",{name,arguments:args});const t=(r.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n");try{return JSON.parse(t)}catch{return {raw:t}}}
 const found=new Map();for(const q of ["","business","psychology","technology","self improvement","leadership","productivity","management"]){const r=await call("search_books",{query:q,limit:100});for(const b of (r.books||r.results||[])){const s=b.slug||b.metadata?.slug;if(s)found.set(s,b)}}
 const out=[];for(const [s] of found){const r=await call("get_book",{slug:s});const m=r.metadata||{};const text=[r.oneLiner,r.content].filter(Boolean).join("\n\n");if(!m.title||!text)continue;out.push({id:"bfa-"+s,bookId:"bfa-"+s,title:m.title,author:m.author||"Unknown",textKu:"",textOriginal:text,wordCount:0,source:"Books for Agents",sourceUrl:"https://booksforagents.com/books/"+s,rights:"CC BY-SA 4.0; adapted from Books for Agents; attribution required; compatible ShareAlike terms",updatedAt:new Date().toISOString(),category:m.category||"General",tags:m.tags||[]})}return out
}
async function austin(){
 const tree=await json("https://api.github.com/repos/AustinT/book-summaries/git/trees/master?recursive=1",{headers:{accept:"application/vnd.github+json"}});
 const files=(tree.tree||[]).filter(x=>x.type==="blob"&&x.path.endsWith(".md")&&!x.path.endsWith("novels.md")&&!x.path.endsWith("short-stories.md")).map(x=>x.path);
 const out=[];for(const f of files){const r=await fetch("https://raw.githubusercontent.com/AustinT/book-summaries/master/"+f,{headers:{"user-agent":UA}});const text=await r.text();if(!text.trim())continue;const title=(text.match(/^#\s+(.+)$/m)||[])[1]?.trim()||path.basename(f,".md");const id="austint-"+slug(f);out.push({id,bookId:id,title,author:"",textKu:"",textOriginal:text,wordCount:0,source:"AustinT/book-summaries",sourceUrl:"https://github.com/AustinT/book-summaries/blob/master/"+f,rights:"MIT repository license; preserve attribution and license notice",updatedAt:new Date().toISOString()})}return out
}
let existing=[];
try{existing=JSON.parse(await fs.readFile(OUT,"utf8"))}catch{}
const all=[...(await booksForAgents()),...(await austin())];
const map=new Map(existing.map(x=>[x.id,x]));
for(const row of all){const prev=map.get(row.id);map.set(row.id,{...prev,...row,updatedAt:prev?.updatedAt||row.updatedAt,textKu:prev?.textKu||row.textKu||"",wordCount:prev?.wordCount||row.wordCount||0})}
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify([...map.values()],null,2)+"\n","utf8");
console.log("Imported "+all.length+" records; preserved "+existing.length+" existing records; total "+map.size);
