import fs from "node:fs/promises";
const input="content/open-sources/cmu-book-summaries.json",output="content/open-sources/imported-summaries.json";
const incoming=JSON.parse(await fs.readFile(input,"utf8"));let existing=[];try{existing=JSON.parse(await fs.readFile(output,"utf8"))}catch{}
const map=new Map(existing.map(x=>[x.id,x]));for(const x of incoming){const old=map.get(x.id);map.set(x.id,{...old,...x,textKu:old?.textKu||x.textKu||"",wordCount:old?.wordCount||x.wordCount||0})}
await fs.writeFile(output,JSON.stringify([...map.values()],null,2)+"
");console.log("Merged "+incoming.length+" CMU records; total "+map.size);