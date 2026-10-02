import fs from "node:fs/promises";

const input="content/external/squality-plot.json";
const output="content/open-sources/imported-summaries.json";
const rows=JSON.parse(await fs.readFile(input,"utf8"));
let existing=[];
try{existing=JSON.parse(await fs.readFile(output,"utf8"));}catch{}
const map=new Map(existing.map(x=>[x.id,x]));
for(const row of rows){
  if(!row.sourceTextEn||!row.title) continue;
  map.set(row.id,{
    id:row.id,
    bookId:row.gutenbergId ? "gutenberg-"+row.gutenbergId : row.id,
    title:row.title,
    author:"Unknown",
    textOriginal:row.sourceTextEn,
    textKu:"",
    wordCount:0,
    source:row.source,
    sourceUrl:row.sourceUrl,
    rights:row.license+"; "+row.rightsNote,
    category:"ئەدەب",
    tags:["SQuALITY","Gutenberg"],
    metadata:{gutenbergId:row.gutenbergId,question:row.question},
    updatedAt:row.importedAt
  });
}
await fs.mkdir("content/open-sources",{recursive:true});
await fs.writeFile(output,JSON.stringify([...map.values()],null,2)+"\n","utf8");
console.log("Merged "+rows.length+" SQuALITY records into "+output+"; total "+map.size);
