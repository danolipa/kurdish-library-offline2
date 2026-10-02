import fs from "node:fs/promises";
const key=process.env.GROQ_API_KEY;if(!key)throw new Error("GROQ_API_KEY is required; keep it in GitHub Actions Secrets.");
const model=process.env.GROQ_MODEL||"openai/gpt-oss-120b";
const limit=Math.max(1,Number(process.env.OPEN_SOURCE_TRANSLATE_LIMIT||"10"));
const input="content/open-sources/imported-summaries.json", output="content/open-sources/imported-summaries-kurdish.json";
const rows=JSON.parse(await fs.readFile(input,"utf8")).filter(x=>x.textOriginal&&!x.textKu).slice(0,limit);
const out=[];
for(const row of rows){
 const prompt=["وەک وەرگێڕ و نووسەری پیشەیی کوردیی ناوەندی (سۆرانی) کار بکە.","دەقی سەرچاوەکە بە سۆرانیی سروشتی و ڕوون وەربگێڕە.","واتا و زانیارییەکانی سەرچاوەکە مەگۆڕە و هیچ ڕووداو یان زانیارییەکی نوێ دروست مەکە.","ئەگەر دەقەکە پوختەیە، پوختەیەک بمێنێت؛ بەبێ هەڵبەستن و درێژکردنەوەی ساختە.","تەنها دەقی کۆتایی سۆرانی بنووسە.","","سەرچاوە:",row.textOriginal].join("\n");
 const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:0.15,max_tokens:5000,messages:[{role:"system",content:"Translate accurately into Central Kurdish Sorani. Never invent facts."},{role:"user",content:prompt}]})});
 if(!res.ok)throw new Error("Groq request failed: "+res.status+" "+await res.text());
 const data=await res.json(),text=data.choices?.[0]?.message?.content?.trim();if(!text)continue;
 out.push({...row,textKu:text,wordCount:text.split(/\s+/).filter(Boolean).length,targetLanguage:"ckb",translatedAt:new Date().toISOString()});console.log("Translated "+row.id);
}
await fs.writeFile(output,JSON.stringify(out,null,2)+"\n");console.log("Wrote "+out.length+" Sorani external summaries.");
