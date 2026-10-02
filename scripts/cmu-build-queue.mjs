import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const SOURCE_URL="https://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz";
const LIMIT=Number(process.env.CMU_LIMIT||1000), OFFSET=process.env.CMU_OFFSET?.trim()?Number(process.env.CMU_OFFSET):Number(JSON.parse(await fs.readFile("content/external/cmu/cursor.json","utf8").catch(()=>"{\"offset\":0}")).offset||0);
const OUT="content/external/cmu/summary-queue.json", TMP="/tmp/cmu-booksummaries.tar.gz", EXTRACT="/tmp/cmu-booksummaries";
const res=await fetch(SOURCE_URL,{headers:{"User-Agent":"Kurdish-Library/1.0"}});
if(!res.ok) throw new Error(`CMU download failed: ${res.status}`);
await pipeline(Readable.fromWeb(res.body),createWriteStream(TMP));
await fs.rm(EXTRACT,{recursive:true,force:true}); await fs.mkdir(EXTRACT,{recursive:true});
const {execFile}=await import("node:child_process"); const {promisify}=await import("node:util");
await promisify(execFile)("tar",["-xzf",TMP,"-C",EXTRACT]);
let source=`${EXTRACT}/booksummaries/booksummaries.txt`;
try{await fs.access(source)}catch{source=`${EXTRACT}/booksummaries.txt`;}
function genres(raw){try{return Object.values(JSON.parse(raw||"{}")).filter(Boolean).slice(0,12)}catch{return[]}}
const queue=[]; let seen=0;
for await(const line of createInterface({input:createReadStream(source),crlfDelay:Infinity})){
 if(!line.trim())continue; const row=line.split("\t"); if(row.length<7)continue;
 if(seen++<OFFSET)continue; const [wikiId,freebaseId,title,author,publishDate,genreRaw,plot]=row;
 if(!title||!plot)continue;
 queue.push({id:`cmu-${wikiId}`,source:"CMU Book Summary Dataset",sourceUrl:"https://www.cs.cmu.edu/~dbamman/booksummaries.html",license:"CC BY-SA 3.0",attribution:"David Bamman and Noah Smith; CMU Book Summary Dataset",wikiId,freebaseId,title,author,publishDate:publishDate||"",genres:genres(genreRaw),textOriginal:plot,status:"queued",minimumSummaryWords:1500,summaryKu:"",summaryWordCount:0});
 if(queue.length>=LIMIT)break;
}
await fs.mkdir("content/external/cmu",{recursive:true});
await fs.writeFile("content/external/cmu/cursor.json",JSON.stringify({offset:OFFSET+queue.length,updatedAt:new Date().toISOString()},null,2)+"\n");
await fs.writeFile(OUT,JSON.stringify({generatedAt:new Date().toISOString(),offset:OFFSET,limit:LIMIT,totalQueued:queue.length,source:SOURCE_URL,license:"CC BY-SA 3.0",items:queue},null,2)+"\n");
console.log(`Queued ${queue.length} CMU books from offset ${OFFSET}.`);
