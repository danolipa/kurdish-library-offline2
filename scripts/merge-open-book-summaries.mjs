import fs from "node:fs/promises";
const input="content/open-sources/imported-summaries.json",output="src/data/summaries.json";
const incoming=JSON.parse(await fs.readFile(input,"utf8"));let existing=[];try{existing=JSON.parse(await fs.readFile(output,"utf8"))}catch{}
const map=new Map(existing.map(x=>[x.id,x]));for(const x of incoming)map.set(x.id,x);const merged=[...map.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title)));await fs.writeFile(output,JSON.stringify(merged,null,2)+"\n","utf8");console.log("Merged "+incoming.length+" records; total "+merged.length);