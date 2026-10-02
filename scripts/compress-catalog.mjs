import fs from "node:fs/promises";
import path from "node:path";
const candidates=["src/data/library.json","src/data/quotes.json","src/data/authors.json"];
for(const file of candidates){
  try{
    const raw=await fs.readFile(file,"utf8");
    const parsed=JSON.parse(raw);
    const compact=JSON.stringify(parsed);
    await fs.writeFile(file,compact+"\n");
    console.log("Compacted",file,compact.length,"bytes");
  }catch{}
}
