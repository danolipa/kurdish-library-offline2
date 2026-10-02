import fs from "node:fs/promises";
const LIMIT=Number(process.env.PUBLIC_BOOK_LIMIT||1000);
const PAGES=Math.ceil(LIMIT/32);
const OUT="src/data/library.json", SUM_OUT="src/data/summaries.json";
async function getJson(url){const r=await fetch(url,{headers:{"user-agent":"Kurdish-Library/1.0"}});if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}
const existingBooks=JSON.parse(await fs.readFile(OUT,"utf8").catch(()=>"[]"));
const existingSummaries=JSON.parse(await fs.readFile(SUM_OUT,"utf8").catch(()=>"[]"));
const books=new Map(existingBooks.map(b=>[b.id,b]));
const summaries=new Map(existingSummaries.map(s=>[s.id,s]));
for(let page=1;page<=PAGES&&books.size<LIMIT;page++){
 const data=await getJson("https://gutendex.com/books/?sort=popular&page="+page);
 for(const item of data.results||[]){
  if(item.media_type!=="Text"||item.copyright===true)continue;
  const id="gutenberg-"+item.id;
  const author=(item.authors?.[0]?.name||"Unknown").trim();
  const category=item.bookshelves?.[0]||item.subjects?.[0]||"Classic";
  books.set(id,{id,title:item.title,author,category,language:item.languages?.[0]||"en",format:"epub",filePath:item.formats?.["application/epub+zip"]||item.formats?.["text/html"]||"",coverPath:item.formats?.["image/jpeg"]||"",summary:item.summaries?.[0]||"",tags:[...(item.bookshelves||[]),...(item.subjects||[])].slice(0,20),addedAt:Date.now(),source:"bundle",sourceUrl:"https://www.gutenberg.org/ebooks/"+item.id,downloadCount:item.download_count,copyright:item.copyright});
  const original=(item.summaries?.[0]||"").trim();
  if(original&&!summaries.has(id))summaries.set(id,{id,bookId:id,title:item.title,textKu:"",textOriginal:original,wordCount:original.split(/\s+/).length,source:"Gutendex / Project Gutenberg",sourceUrl:"https://www.gutenberg.org/ebooks/"+item.id,rights:"Source rights must be checked before redistribution.",updatedAt:new Date().toISOString()});
  if(books.size>=LIMIT)break;
 }
 console.log("page "+page+": "+books.size);
}
await fs.writeFile(OUT,JSON.stringify([...books.values()].slice(0,LIMIT),null,2)+"\n");
await fs.writeFile(SUM_OUT,JSON.stringify([...summaries.values()],null,2)+"\n");
console.log("Imported "+Math.min(books.size,LIMIT)+" books and "+summaries.size+" source summaries.");