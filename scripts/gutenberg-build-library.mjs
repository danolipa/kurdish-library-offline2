import fs from "node:fs/promises";
const CATALOG_URL="https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";
const LIMIT=Number(process.env.LIBRARY_LIMIT||"10000");
const ENRICH_LIMIT=Number(process.env.OPENLIBRARY_ENRICH_LIMIT||"500");
const OUT="src/data/library.json", ENRICH="content/public-sources/openlibrary-enrichment.json";
function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(quoted){if(ch==='"'&&nx==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell="";}else if(ch==="\\n"){row.push(cell);rows.push(row);row=[];cell="";}else if(ch!=="\\r")cell+=ch;}if(cell||row.length){row.push(cell);rows.push(row);}const headers=rows.shift();return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])))}
function firstUrl(v){return String(v||"").split(";").map(x=>x.trim()).find(x=>/^https?:\\/\\//.test(x))||"";}
async function readJson(path,fallback={}){try{return JSON.parse(await fs.readFile(path,"utf8"))}catch{return fallback}}
const csv=await (await fetch(CATALOG_URL)).text();
const rows=parseCsv(csv).filter(x=>x.Type==="Text");
const priority=[1342,1,2701,1661,174,35,98,26740,64317,84];
rows.sort((a,b)=>{const pa=priority.indexOf(Number(a["Text#"])),pb=priority.indexOf(Number(b["Text#"]));return (pa<0?999999:pa)-(pb<0?999999:pb)});
const chosen=rows.slice(0,LIMIT), enrich=await readJson(ENRICH,{});
const candidates=chosen.slice(0,ENRICH_LIMIT).filter(x=>!enrich[String(x["Text#"])]);let idx=0;
async function worker(){while(idx<candidates.length){const item=candidates[idx++],id=String(item["Text#"]);try{const title=item.Title||"",author=(item.Authors||"").split(",")[0].replace(/\\s*\\(.*?\\)/g,"").trim();const url="https://openlibrary.org/search.json?title="+encodeURIComponent(title)+"&author="+encodeURIComponent(author)+"&limit=1";const data=await (await fetch(url,{headers:{"User-Agent":"Kurdish-Library/1.0"}})).json(),d=data.docs?.[0];if(d)enrich[id]={coverUrl:d.cover_i?"https://covers.openlibrary.org/b/id/"+d.cover_i+"-L.jpg":null,openLibraryKey:d.key||null,description:Array.isArray(d.first_sentence)?d.first_sentence[0]:null,sourceUrl:"https://openlibrary.org",license:"Open Library bibliographic metadata; verify individual media rights"};}catch(e){enrich[id]={error:String(e?.message||e),sourceUrl:"https://openlibrary.org"}}await new Promise(r=>setTimeout(r,120))}}
await Promise.all(Array.from({length:4},worker));
await fs.mkdir("content/public-sources",{recursive:true});await fs.writeFile(ENRICH,JSON.stringify(enrich,null,2)+"\\n");
const books=chosen.map((x,i)=>{const id=String(x["Text#"]),e=enrich[id]||{},title=x.Title||("Gutenberg "+id),author=(x.Authors||"Unknown").split(",")[0].replace(/\\s*\\(.*?\\)/g,"").trim()||"Unknown",subjects=(x.Subjects||"").split(";").map(s=>s.trim()).filter(Boolean),lang=(x.Language||"en").split(";")[0].trim();return {id:"gutenberg-"+id,title,author,category:subjects[0]||"کلاسیک",language:lang,format:"txt",filePath:firstUrl(x["Download Links"]),coverPath:e.coverUrl||undefined,tags:subjects.slice(0,8),addedAt:Date.now()-i,source:"bundle"}});
await fs.mkdir("src/data",{recursive:true});await fs.writeFile(OUT,JSON.stringify(books,null,2)+"\\n");console.log("Built "+books.length+" Gutenberg records; enriched "+Object.keys(enrich).length+" records from Open Library.");