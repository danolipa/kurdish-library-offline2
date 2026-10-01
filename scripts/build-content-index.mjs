import fs from "node:fs";
import path from "node:path";

const inputDir=process.argv[2]||"content";
const outDir=process.argv[3]||"src/data";
const files=["summaries.json","quotes.json","authors.json"];

function read(name){
  const p=path.join(inputDir,name);
  if(!fs.existsSync(p)) return [];
  const value=JSON.parse(fs.readFileSync(p,"utf8"));
  if(!Array.isArray(value)) throw new Error(name+" must contain a JSON array");
  return value;
}

const summaries=read("summaries.json").map((x,i)=>({
  id:x.id||"summary-"+String(i+1).padStart(5,"0"),
  bookId:x.bookId||x.book_id||"",
  title:x.title||"",
  textKu:x.textKu||x.summaryKu||"",
  textOriginal:x.textOriginal||x.summary||"",
  wordCount:Number(x.wordCount)||String(x.textKu||"").trim().split(/\s+/).filter(Boolean).length,
  source:x.source||"",
  sourceUrl:x.sourceUrl||"",
  rights:x.rights||"original",
  updatedAt:x.updatedAt||new Date().toISOString()
}));

const quotes=read("quotes.json").map((x,i)=>({
  id:x.id||"quote-"+String(i+1).padStart(5,"0"),
  textOriginal:x.textOriginal||x.text||"",
  textKu:x.textKu||x.translationKu||"",
  author:x.author||"",
  authorId:x.authorId||"",
  source:x.source||"",
  sourceUrl:x.sourceUrl||"",
  rights:x.rights||"original",
  imagePath:x.imagePath||"",
  updatedAt:x.updatedAt||new Date().toISOString()
}));

const authors=read("authors.json").map((x,i)=>({
  id:x.id||"author-"+String(i+1).padStart(5,"0"),
  name:x.name||"",
  bioKu:x.bioKu||"",
  imagePath:x.imagePath||"",
  source:x.source||"",
  sourceUrl:x.sourceUrl||"",
  rights:x.rights||"original"
}));

fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"summaries.json"),JSON.stringify(summaries,null,2)+"\n");
fs.writeFileSync(path.join(outDir,"quotes.json"),JSON.stringify(quotes,null,2)+"\n");
fs.writeFileSync(path.join(outDir,"authors.json"),JSON.stringify(authors,null,2)+"\n");
console.log(`Built content index: ${summaries.length} summaries, ${quotes.length} quotes, ${authors.length} authors.`);
