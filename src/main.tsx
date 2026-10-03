import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjsLib from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import ePub from "epubjs";
import { SocialLogin } from "@capgo/capacitor-social-login";
import type { Book, Quote, Summary, Author, Highlight, Note } from "./types";
import bundledBooks from "./data/library.json";
import bundledQuotes from "./data/quotes.json";
import bundledAuthors from "./data/authors.json";
import { getBookFile, getBookState, getBooks, getSummaries, getQuotes, getAuthors, saveBook, saveBookState, saveProgress, saveSummaries, saveQuotes, saveAuthors, getExtractedText, saveExtractedText, searchExtractedText, getHighlights, saveHighlight, deleteHighlight, getNotes, saveNote, deleteNote, getAIHistory, saveAIHistory, clearAIHistory } from "./storage";
import "./styles.css";
import "./styles/themes.css";
import "./styles/feature-pack.css";
import "./styles/page-flip.css";
import "./styles/bottom-sheet.css";
import "./styles/fab.css";
import "./styles/skeleton.css";
import "./styles/reading-progress.css";
import "./styles/theme-selector.css";
import "./styles/book-cover-3d.css";
import "./styles/brightness.css";
import "./styles/transitions.css";
import { registerServiceWorker } from "./serviceWorkerRegistration";
import ErrorBoundary from "./components/ErrorBoundary";
import { initGlobalErrorHandler } from "./lib/offlineCrashReporter";
import { applyA11y, loadA11y } from "./lib/accessibility";
import { ThemeProvider } from "./contexts/ThemeContext";
import { loadKurdishFonts } from "./lib/fontLoader";


// PDF.js runs without a Web Worker for maximum Capacitor/Android WebView compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

const seed: Book[] = [
  { id:"demo-1", title:"نموونەی کتێبی یەکەم", author:"کتێبخانەی کوردی", category:"ئەدەب", language:"کوردی", format:"txt", summary:"ئەمە کتێبێکی نموونەییە بۆ تاقیکردنەوەی خوێندنەوە.", addedAt:Date.now(), source:"bundle" },
  { id:"demo-2", title:"زانست و ژیان", author:"کتێبخانەی کوردی", category:"زانست", language:"کوردی", format:"txt", summary:"بابەتێکی نموونەیی لەسەر زانست و ژیان.", addedAt:Date.now()-1, source:"bundle" },
  { id:"demo-3", title:"مێژووی کورد", author:"کتێبخانەی کوردی", category:"مێژوو", language:"کوردی", format:"txt", summary:"نموونەیەک بۆ پۆلێنکردن و گەڕان.", addedAt:Date.now()-2, source:"bundle" }
];

const AI_PROVIDERS = {
  groq: { label:"Groq", base:"https://api.groq.com/openai/v1", defaultModel:"openai/gpt-oss-120b" },
  openai: { label:"OpenAI", base:"https://api.openai.com/v1", defaultModel:"gpt-4o-mini" },
  gemini: { label:"Google Gemini", base:"https://generativelanguage.googleapis.com/v1beta", defaultModel:"gemini-2.5-flash" },
  openrouter: { label:"OpenRouter", base:"https://openrouter.ai/api/v1", defaultModel:"openai/gpt-4o-mini" },
  anthropic: { label:"Anthropic", base:"https://api.anthropic.com/v1", defaultModel:"claude-3-5-haiku-latest" },
  custom: { label:"Custom OpenAI-compatible", base:"", defaultModel:"" }
} as const;
type AIProvider = keyof typeof AI_PROVIDERS;
type AIConfig = { provider:AIProvider; apiKey:string; model:string; baseUrl:string };
type GoogleProfile = { id:string; email?:string; name?:string; picture?:string };
type SourcePackIndex = { file:string; count:number; ids:string[] };
type SourceSummaryManifest = { version:number; generatedAt?:string; total:number; packSize:number; packs:SourcePackIndex[] };
type SourceSummaryRow = { id:string; bookId?:string; title:string; author?:string; textOriginal:string; textKu?:string; wordCount?:number; source?:string; sourceUrl?:string; rights?:string };

function loadAIConfig():AIConfig{
  try{
    const raw=localStorage.getItem("kurdish-library-ai");
    if(raw){
      const x=JSON.parse(raw);
      const provider=(x.provider in AI_PROVIDERS?x.provider:"groq") as AIProvider;
      return {provider,apiKey:typeof x.apiKey==="string"?x.apiKey:"",model:typeof x.model==="string"?x.model:AI_PROVIDERS[provider].defaultModel,baseUrl:typeof x.baseUrl==="string"?x.baseUrl:""};
    }
  }catch{}
  return {provider:"groq",apiKey:"",model:AI_PROVIDERS.groq.defaultModel,baseUrl:""};
}

async function testAIConfig(config:AIConfig):Promise<string>{
  if(!config.apiKey.trim()) throw new Error("کلیلی API داخل نەکراوە");
  if(config.provider==="gemini"){
    const r=await fetch((config.baseUrl||AI_PROVIDERS.gemini.base)+"/models?key="+encodeURIComponent(config.apiKey));
    if(!r.ok) throw new Error("Gemini API Key ڕەتکرایەوە");
    return "Gemini API کار دەکات ✓";
  }
  if(config.provider==="anthropic"){
    const r=await fetch((config.baseUrl||AI_PROVIDERS.anthropic.base)+"/models",{headers:{"x-api-key":config.apiKey,"anthropic-version":"2023-06-01"}});
    if(!r.ok) throw new Error("Anthropic API Key ڕەتکرایەوە");
    return "Anthropic API کار دەکات ✓";
  }
  const base=(config.baseUrl||AI_PROVIDERS[config.provider].base).replace(/\/$/,"");
  const r=await fetch(base+"/models",{headers:{Authorization:"Bearer "+config.apiKey}});
  if(!r.ok) throw new Error("API Key یان endpoint ڕەتکرایەوە");
  return AI_PROVIDERS[config.provider].label+" API کار دەکات ✓";
}

async function askAI(config:AIConfig,prompt:string,maxTokens=1800):Promise<string>{
  if(!config.apiKey.trim()) throw new Error("سەرەتا API Key زیاد بکە");
  if(config.provider==="gemini"){
    const base=(config.baseUrl||AI_PROVIDERS.gemini.base).replace(/\/$/,"");
    const r=await fetch(base+"/models/"+encodeURIComponent(config.model)+":generateContent?key="+encodeURIComponent(config.apiKey),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.15,maxOutputTokens:maxTokens}})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data?.error?.message||"Gemini request failed");
    return data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"وەڵامێک نەگەڕایەوە.";
  }
  if(config.provider==="anthropic"){
    const base=(config.baseUrl||AI_PROVIDERS.anthropic.base).replace(/\/$/,"");
    const r=await fetch(base+"/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":config.apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:config.model,max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data?.error?.message||"Anthropic request failed");
    return data?.content?.map((p:any)=>p.text||"").join("")||"وەڵامێک نەگەڕایەوە.";
  }
  const base=(config.baseUrl||AI_PROVIDERS[config.provider].base).replace(/\/$/,"");
  const r=await fetch(base+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+config.apiKey},body:JSON.stringify({model:config.model,max_tokens:maxTokens,messages:[{role:"system",content:"You are a helpful Kurdish Library assistant. Answer in natural Central Kurdish (Sorani) unless the user asks otherwise. Do not invent facts."},{role:"user",content:prompt}],temperature:.15})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message||"AI request failed");
  return data?.choices?.[0]?.message?.content||"وەڵامێک نەگەڕایەوە.";
}

function PageControls({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}){
  if(total<=1)return null;
  const from=Math.max(1,page-2), to=Math.min(total,from+4), start=Math.max(1,to-4);
  return <div className="pager"><button disabled={page===1} onClick={()=>onChange(page-1)}>‹ پێشوو</button>{Array.from({length:to-start+1},(_,i)=>start+i).map(n=><button key={n} className={n===page?"active":""} onClick={()=>onChange(n)}>{n}</button>)}<button disabled={page===total} onClick={()=>onChange(page+1)}>دواتر ›</button></div>;
}

function App(){
  const [books,setBooks]=useState<Book[]>(seed);
  const [query,setQuery]=useState("");
  const [globalSearchOpen,setGlobalSearchOpen]=useState(false);
  const [category,setCategory]=useState("هەموو");
  const [theme,setTheme]=useState<"light"|"dark"|"sepia"|"eink">("light");
  const [selected,setSelected]=useState<Book|null>(null);
  const [states,setStates]=useState<Record<string,Awaited<ReturnType<typeof getBookState>>>>({});
  const [notice,setNotice]=useState("");
  const [readerPage,setReaderPage]=useState(1);
  const [fontSize,setFontSize]=useState(19);
  const [fileUrl,setFileUrl]=useState<string|null>(null);
  const [readerMode,setReaderMode]=useState<"normal"|"ink">("normal");
  const [split,setSplit]=useState<1|2|4>(1);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [font,setFont]=useState("system");
  const [compact,setCompact]=useState(false);
  const [tab,setTab]=useState<"home"|"library"|"summaries"|"quotes"|"favorites"|"media"|"internet">("home");
  const [viewMode,setViewMode]=useState<"grid"|"shelf"|"list"|"small">("grid");
  const [notebookOpen,setNotebookOpen]=useState(false);
  const [notes,setNotes]=useState<Note[]>([]);
  const [noteSearch,setNoteSearch]=useState("");
  const [noteBookId,setNoteBookId]=useState("all");
  const [activeNoteId,setActiveNoteId]=useState<string|null>(null);
  const [noteDraft,setNoteDraft]=useState("");
  const [noteTitle,setNoteTitle]=useState("");
  const [notebookFilter,setNotebookFilter]=useState("");
  const [summaries,setSummaries]=useState<Summary[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [authors,setAuthors]=useState<Author[]>([]);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [extractedText,setExtractedText]=useState<Record<string,string>>({});
  const [ocrBusy,setOcrBusy]=useState(false);
  const [highlights,setHighlights]=useState<Highlight[]>([]);
  const [readerJump,setReaderJump]=useState<number|undefined>(undefined);
  const [textMatches,setTextMatches]=useState<Set<string>>(new Set());
  const [libraryPage,setLibraryPage]=useState(1);
  const [summaryPage,setSummaryPage]=useState(1);
  const [aiConfig,setAiConfig]=useState<AIConfig>(()=>loadAIConfig());
  const [aiKeyVisible,setAiKeyVisible]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiResult,setAiResult]=useState("");
  const [aiOpen,setAiOpen]=useState(false);
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiHistory,setAiHistory]=useState<Awaited<ReturnType<typeof getAIHistory>>>([]);
  const [aiThread,setAiThread]=useState<Array<{role:"user"|"assistant";content:string}>>([]);
  const [studyOpen,setStudyOpen]=useState(false);
  const [studyBusy,setStudyBusy]=useState(false);
  const [sourceManifest,setSourceManifest]=useState<SourceSummaryManifest|null>(null);
  const [translationBusy,setTranslationBusy]=useState(false);
  const [internetQuery,setInternetQuery]=useState("");
  const [internetSource,setInternetSource]=useState<"all"|"gutenberg"|"openlibrary"|"archive">("all");
  const [internetBooks,setInternetBooks]=useState<any[]>([]);
  const [internetBusy,setInternetBusy]=useState(false);
  const [internetImporting,setInternetImporting]=useState<number|null>(null);
  const [translationProgress,setTranslationProgress]=useState({done:0,total:0});
  const [quoteBusy,setQuoteBusy]=useState(false);
  const [aiPanelTab,setAiPanelTab]=useState<"chat"|"summarize"|"translate">("chat");

  const translationStopRef=useRef(false);
  const readerRequestRef=useRef(0);
  const sourcePackCache=useRef(new Map<string,SourceSummaryRow[]>());
  const [googleProfile,setGoogleProfile]=useState<GoogleProfile|null>(null);
  const [googleClientId,setGoogleClientId]=useState(()=>localStorage.getItem("kurdish-library-google-client-id")||(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID||"").trim());

  useEffect(()=>{
    const id=googleClientId.trim();
    if(!id) return;
    SocialLogin.initialize({google:{webClientId:id,mode:"online"}}).catch(()=>{});
  },[googleClientId]);
  function saveGoogleClientId(){
    const id=googleClientId.trim();
    if(!id){localStorage.removeItem("kurdish-library-google-client-id");setGoogleClientId("");setNotice("Google Web Client ID سڕایەوە.");return;}
    localStorage.setItem("kurdish-library-google-client-id",id);
    setGoogleClientId(id);
    setNotice("Google Web Client ID پاشەکەوت کرا ✓");
  }
  async function googleSignIn(){
    if(!googleClientId){setNotice("تکایە Google Web Client ID دابین بکە.");return;}
    try{
      const res:any=await SocialLogin.login({provider:"google",options:{scopes:["email","profile"],filterByAuthorizedAccounts:false}});
      const gp=res?.result?.profile||{};
      const profile:GoogleProfile={id:gp.id||"",email:gp.email||undefined,name:gp.name||undefined,picture:gp.imageUrl||undefined};
      setGoogleProfile(profile); localStorage.setItem("kurdish-library-google-profile",JSON.stringify(profile));
      setNotice("بە Google چوویتە ژوورەوە ✓");
    }catch(e:any){setNotice("چوونەژوورەوەی Google سەرکەوتوو نەبوو: "+(e?.message||"هەڵە"))}
  }
  async function googleSignOut(){try{await SocialLogin.logout({provider:"google"});}catch{} setGoogleProfile(null); localStorage.removeItem("kurdish-library-google-profile"); setNotice("لە Google دەرچوویت.");}
  async function persistNote(note: Note){
    await saveNote(note);
    setNotes(await getNotes());
    setNoteTitle(note.title);
    setNoteDraft(note.body);
    setNoteBookId(note.bookId);
    setActiveNoteId(note.id);
    setNotice("تێبینی بە ئۆفلاین پاشەکەوت کرا ✓");
  }
  async function removeNote(id:string){
    await deleteNote(id);
    setNotes(await getNotes());
    setNotice("تێبینی سڕایەوە.");
  }

  useEffect(()=>{fetch("/data/source-summaries/manifest.json").then(r=>r.ok?r.json():null).then((manifest)=>{if(manifest?.packs?.length)setSourceManifest(manifest);}).catch(()=>{}); getNotes().then(setNotes).catch(()=>{}); getHighlights().then(setHighlights).catch(()=>{}); getAIHistory().then(setAiHistory).catch(()=>{}); try{const p=localStorage.getItem("kurdish-library-google-profile");if(p)setGoogleProfile(JSON.parse(p));}catch{} },[]);
  useEffect(()=>{
    const bb=(bundledBooks as Book[]); const bq=(bundledQuotes as Quote[]); const ba=(bundledAuthors as Author[]);
    setBooks(prev=>prev.length>3?prev:[...bb,...prev]); setQuotes(bq); setAuthors(ba);
    getBooks().then(saved=>{
      const map=new Map<string,Book>((bundledBooks as Book[]).map(b=>[b.id,b]));
      for(const book of saved) map.set(book.id,book);
      const merged=[...map.values()];
      setBooks(merged);
    }).catch(()=>{});
    getQuotes().then(saved=>{
      const map=new Map<string,Quote>((bundledQuotes as Quote[]).map(q=>[q.id,q]));
      for(const quote of saved) map.set(quote.id,quote);
      setQuotes([...map.values()]);
    }).catch(()=>{});
    getAuthors().then(saved=>{
      const map=new Map<string,Author>((bundledAuthors as Author[]).map(a=>[a.id,a]));
      for(const author of saved) map.set(author.id,author);
      setAuthors([...map.values()]);
    }).catch(()=>{});
    getSummaries().then(async saved=>{
      const map=new Map<string,Summary>();
      for(const item of saved) map.set(item.id,item);
      try{
        const manifest=await fetch("/data/summaries/manifest.json").then(r=>r.ok?r.json():null);
        if(manifest?.packs?.length){
          for(let i=0;i<manifest.packs.length;i+=6){
            const batch=manifest.packs.slice(i,i+6);
            const parts=await Promise.all(batch.map((p:any)=>fetch("/data/summaries/"+p.file).then(r=>r.ok?r.json():[])));
            for(const part of parts) if(Array.isArray(part)) for(const item of part){if(!map.has(item.id))map.set(item.id,item);}
            setSummaries([...map.values()]);
          }
        }else{
          setSummaries([...map.values()]);
        }
      }catch{
        setSummaries([...map.values()]);
      }
    }).catch(()=>{});
  },[]);
  useEffect(()=>{
    const q=query.trim();
    let cancelled=false;
    if(q.length<2){ setTextMatches(new Set()); return ()=>{cancelled=true}; }
    searchExtractedText(q).then(ids=>{if(!cancelled)setTextMatches(ids)}).catch(()=>{if(!cancelled)setTextMatches(new Set())});
    return ()=>{cancelled=true};
  },[query]);
  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),2200); return()=>clearTimeout(t); },[notice]);
  useEffect(()=>{setLibraryPage(1);},[query,category,tab,viewMode]);
  useEffect(()=>{
    if(!aiOpen)return;
    const prior=selected?aiHistory.filter(x=>x.bookId===selected.id).slice(0,4).reverse():[];
    setAiThread(prior.flatMap(x=>[{role:"user" as const,content:x.prompt},{role:"assistant" as const,content:x.answer.slice(0,4000)}]));
  },[aiOpen,selected?.id]);
  useEffect(()=>{setSummaryPage(1);},[summaries.length]);
  useEffect(()=>{
    try{
      const raw=localStorage.getItem("kurdish-library-settings");
      if(raw){const s=JSON.parse(raw);if(["light","dark","sepia","eink"].includes(s.theme))setTheme(s.theme);if(["system","serif","sans"].includes(s.font))setFont(s.font);if(Number.isFinite(s.fontSize))setFontSize(Math.max(14,Math.min(30,Number(s.fontSize))));if(typeof s.compact==="boolean")setCompact(s.compact);if(["grid","shelf","list","small"].includes(s.viewMode))setViewMode(s.viewMode);}
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("kurdish-library-settings",JSON.stringify({theme,font,fontSize,compact,viewMode}));}catch{}},[theme,font,fontSize,compact,viewMode]);
  useEffect(()=>{try{localStorage.setItem("kurdish-library-ai",JSON.stringify(aiConfig));}catch{}},[aiConfig]);

  const categories=useMemo(()=>["هەموو",...Array.from(new Set(books.map(b=>b.category).filter(Boolean)))],[books]);
  const favoriteBooks=useMemo(()=>books.filter(b=>states[b.id]?.favorite),[books,states]);
  const recentBooks=useMemo(()=>[...books].sort((a,b)=>(states[b.id]?.lastReadAt||0)-(states[a.id]?.lastReadAt||0)).slice(0,12),[books,states]);
  const resumeBooks=useMemo(()=>recentBooks.filter(b=>(states[b.id]?.progress||0)>0).slice(0,6),[recentBooks,states]);
  const visibleBooks=tab==="favorites"?favoriteBooks:books;
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return visibleBooks.filter(b=>{
      if(category!=="هەموو"&&b.category!==category) return false;
      if(!q) return true;
      const bookNotes=notes.filter(n=>n.bookId===b.id).map(n=>[n.title,n.body,n.tags?.join(" ")].filter(Boolean).join(" ")).join(" ");
      const metadata=[b.title,b.author,b.category,b.summary,b.summaryKu,b.tags?.join(" "),bookNotes]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return metadata.includes(q) || textMatches.has(b.id);
    });
  },[visibleBooks,query,category,notes,textMatches]);

  const pageSize=viewMode==="small"?60:40;
  const totalLibraryPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safeLibraryPage=Math.min(libraryPage,totalLibraryPages);
  const pagedBooks=filtered.slice((safeLibraryPage-1)*pageSize,safeLibraryPage*pageSize);
  const summaryPageSize=6;
  const totalSummaryPages=Math.max(1,Math.ceil(summaries.length/summaryPageSize));
  const safeSummaryPage=Math.min(summaryPage,totalSummaryPages);
  const pagedSummaries=summaries.slice((safeSummaryPage-1)*summaryPageSize,safeSummaryPage*summaryPageSize);
  const sourceIndex=useMemo(()=>sourceManifest?.packs.flatMap(pack=>pack.ids.map(id=>({id,file:pack.file})))||[],[sourceManifest]);
  const sourceIdSet=useMemo(()=>new Set(sourceIndex.map(x=>x.id)),[sourceIndex]);
  const summaryIdSet=useMemo(()=>new Set(summaries.map(x=>x.id)),[summaries]);
  const translatedSourceCount=useMemo(()=>sourceIndex.reduce((n,x)=>n+(summaryIdSet.has(x.id)?1:0),0),[sourceIndex,summaryIdSet]);

  async function runAI(prompt:string){
    setAiBusy(true); setAiResult("");
    const recent=aiThread.slice(-6).map(x=>(x.role==="user"?"خوێنەر":"یاریدەدەری")+": "+x.content.slice(0,1800)).join("\n\n");
    const contextual=recent ? "ئەمە بەشێکە لە گفتوگۆی پێشوومان:\n\n"+recent+"\n\nداواکاری نوێی خوێنەر:\n"+prompt : prompt;
    try{
      const result=await askAI(aiConfig,contextual);
      setAiResult(result);
      setAiThread(prev=>[...prev,{role:"user" as const,content:prompt},{role:"assistant" as const,content:result}].slice(-12));
      if(selected){
        const item={id:`ai-${Date.now()}`,bookId:selected.id,provider:aiConfig.provider,model:aiConfig.model,prompt,answer:result,createdAt:Date.now()};
        await saveAIHistory(item); setAiHistory(await getAIHistory());
      }
      setNotice("AI وەڵامی دا و پاشەکەوتی کرد ✓");
    }catch(e:any){
      const err="هەڵە: "+(e?.message||"داواکاری AI سەرکەوتوو نەبوو");
      setAiResult(err);setNotice("داواکاری AI سەرکەوتوو نەبوو");
    }finally{setAiBusy(false);}
  }
  async function startStudyMode(){
    if(!selected){setNotice("سەرەتا کتێبێک هەڵبژێرە");return;}
    setStudyOpen(true); setStudyBusy(true); setAiResult("");
    try{
      const sourceText=(extractedText[selected.id]||bookTextFor(selected)||selected.summaryKu||selected.summary||"").slice(0,18000);
      const prompt=`لەسەر ئەم کتێبە Study Mode ـێکی سۆرانی دروست بکە. ئەمانە بدە: 1) 5 پرسیاری تێگەیشتن، 2) 5 پرسیاری بیرکردنەوە، 3) 5 flashcard بە شێوەی پرسیار/وەڵام، 4) کورتەی خاڵە سەرەکییەکان. تەنها پشت بە دەقی خوارەوە ببەستە و هیچ زانیارییەکی دەرەکی زیاد مەکە.\n\nکتێب: ${selected.title}\nنووسەر: ${selected.author}\n\nدەق:\n${sourceText}`;
      const result=await askAI(aiConfig,prompt); setAiResult(result);
      const item={id:`ai-study-${Date.now()}`,bookId:selected.id,provider:aiConfig.provider,model:aiConfig.model,prompt:"Study Mode",answer:result,createdAt:Date.now()};
      await saveAIHistory(item); setAiHistory(await getAIHistory());
    }catch(e:any){setAiResult("هەڵە: "+(e?.message||"Study Mode سەرکەوتوو نەبوو"));} finally{setStudyBusy(false);}
  }
  async function askBookAI(prompt:string){
    if(!selected){setNotice("سەرەتا کتێبێک هەڵبژێرە بۆ ئەوەی AI بتوانێت لەسەری کار بکات.");setAiOpen(true);return;}
    const sourceText=(extractedText[selected.id]||bookTextFor(selected)||selected.summaryKu||selected.summary||"").slice(0,18000);
    const context="کتێب: "+selected.title+"\\nنووسەر: "+selected.author+"\\nپۆل: "+selected.category+"\\n\\nدەقی بەردەست لە کتێب/پوختە:\\n"+sourceText;
    await runAI("تۆ یاریدەدەری کتێبخانەی کوردییت. وەڵام بە سۆرانیی سروشتی بدە. تەنها بە پشتبەستن بە زانیاریی خوارەوە وەڵام بدە و ئەگەر زانیارییەک نییە، بە ڕوونی بڵێ.\\n\\n"+context+"\\n\\nداواکاری خوێنەر: "+prompt);
  }
  async function summarizeSelectedBook(){
    if(!selected){setAiOpen(true);setNotice("کتێبێک هەڵبژێرە، پاشان لەسەر ئایکۆنی AI کرتە بکە.");return;}
    if(!aiConfig.apiKey.trim()){setSettingsOpen(true);setNotice("API Key نەدۆزرایەوە؛ لە ڕێکخستنەکان زیادیکە.");return;}
    setAiOpen(true);setAiPanelTab("summarize");
    await askBookAI("پوختەیەکی تەواو و ڕێکخراوی ئەم کتێبە بە سۆرانی بنووسە. بیرۆکە سەرەکییەکان، بابەتە گرنگەکان و ئەنجامی کتێب بە شێوەی خاڵ‌بەندی و پاشان پوختەی کورت بدە. هیچ زانیارییەک لە دەرەوەی دەقی بەردەست زیاد مەکە.");
  }
  async function translateSelectedBook(){
    if(!selected){setAiOpen(true);setNotice("سەرەتا کتێبێک هەڵبژێرە.");return;}
    if(!aiConfig.apiKey.trim()){setSettingsOpen(true);setNotice("API Key نەدۆزرایەوە؛ لە ڕێکخستنەکان زیادیکە.");return;}
    setAiOpen(true);setAiPanelTab("translate");
    await askBookAI("دەقی بەردەست لە کتێبەکە بۆ سۆرانیی ناوەندیی سروشتی وەرگێڕە. واتا و شێوازی نووسین بپارێزە. هیچ زانیارییەک زیاد مەکە. تەنها وەرگێڕانەکە بنووسە.");
  }

  async function loadSourceSummary(id:string):Promise<SourceSummaryRow|null>{
    const hit=sourceIndex.find(x=>x.id===id);
    if(!hit)return null;
    const cached=sourcePackCache.current.get(hit.file);
    if(cached)return cached.find(x=>x.id===id)||null;
    const r=await fetch("/data/source-summaries/"+hit.file);
    if(!r.ok)return null;
    const rows=await r.json();
    if(!Array.isArray(rows))return null;
    sourcePackCache.current.set(hit.file,rows);
    return rows.find((x:any)=>x.id===id)||null;
  }

  async function translateSourceSummaryId(id:string){
    if(!sourceIdSet.has(id)){setNotice("سەرچاوەی ئینگلیزی بۆ ئەم کتێبە نییە.");return false;}
    if(!aiConfig.apiKey.trim()){setNotice("بۆ وەرگێڕان، یەکەم جار API Key لە ڕێکخستنەکان زیاد بکە.");setSettingsOpen(true);return false;}
    const row=await loadSourceSummary(id);
    if(!row?.textOriginal){setNotice("دەقی سەرچاوەکە بەردەست نییە.");return false;}
    const book=books.find(b=>b.id===id);
    const prompt=[
      "وەک وەرگێڕ و دەستنووسکاری پیشەیی کوردیی ناوەندی (سۆرانی) کار بکە.",
      "دەقی خوارەوە بە تەواوی و بە وردی بگۆڕە بۆ سۆرانیی سروشتی و خوێندراو.",
      "هیچ زانیارییەکی نوێ زیاد مەکە و هیچ بڕیارێکی نووسەر یان ڕووداوێک مەگۆڕە.",
      "ناوی کەس، شوێن و ناوی کتێبەکان بە شێوەیەکی دروست و ناسراو بنووسە.",
      "پوختەکە لە شێوەی پوختە بمێنێتەوە؛ دەقی سەرچاوە بەهۆی درێژکردنەوەی ساختە گەورە مەکە.",
      "تەنها دەقی کۆتایی سۆرانی بنووسە، بەبێ پێشەکی یان تێبینی.",
      "",
      "کتێب: "+(book?.title||row.title),
      "نووسەر: "+(book?.author||row.author||"Unknown"),
      "",
      "دەقی سەرچاوە:",
      row.textOriginal.slice(0,30000)
    ].join("\n");
    const text=await askAI(aiConfig,prompt,5000);
    const now=new Date().toISOString();
    const summary:Summary={
      id:row.id,
      bookId:row.bookId||row.id,
      title:row.title,
      textKu:text.trim(),
      textOriginal:row.textOriginal,
      wordCount:text.trim().split(/\s+/).filter(Boolean).length,
      source:row.source,
      sourceUrl:row.sourceUrl,
      rights:row.rights,
      updatedAt:now
    };
    await saveSummaries([summary]);
    setSummaries(prev=>prev.some(x=>x.id===summary.id)?prev.map(x=>x.id===summary.id?summary:x):[summary,...prev]);
    const b=books.find(x=>x.id===summary.bookId);
    if(b){
      const next={...b,summaryKu:summary.textKu};
      setBooks(prev=>prev.map(x=>x.id===b.id?next:x));
      await saveBook(next);
    }
    setNotice("پوختەی سۆرانی پاشەکەوت کرا ✓");
    return true;
  }

  async function translateSelectedSummary(){
    if(!selected)return;
    setTranslationBusy(true);
    setTranslationProgress({done:0,total:1});
    translationStopRef.current=false;
    try{
      await translateSourceSummaryId(selected.id);
      setTranslationProgress({done:1,total:1});
    }catch(e:any){
      setNotice("وەرگێڕان سەرکەوتوو نەبوو: "+(e?.message||"هەڵە"));
    }finally{
      setTranslationBusy(false);
      translationStopRef.current=false;
    }
  }

  async function translateNextSourceSummaries(limit=5){
    if(translationBusy)return;
    if(!aiConfig.apiKey.trim()){setNotice("بۆ وەرگێڕانی batch، API Key زیاد بکە.");setSettingsOpen(true);return;}
    const pending=sourceIndex.filter(x=>!summaryIdSet.has(x.id)).slice(0,Math.max(1,Math.min(25,limit)));
    if(!pending.length){setNotice("هەموو سەرچاوە بەردەستەکان پوختەی سۆرانییان هەیە ✓");return;}
    translationStopRef.current=false;
    setTranslationBusy(true);
    setTranslationProgress({done:0,total:pending.length});
    let done=0;
    try{
      for(const item of pending){
        if(translationStopRef.current)break;
        try{await translateSourceSummaryId(item.id);}catch{}
        done++;
        setTranslationProgress({done,total:pending.length});
      }
    }finally{
      setTranslationBusy(false);
      translationStopRef.current=false;
    }
  }

  async function extractQuotesForSelectedBook(){
    if(!selected){setNotice("سەرەتا کتێبێک هەڵبژێرە.");return;}
    const sourceText=(extractedText[selected.id]||bookTextFor(selected)||"").trim();
    if(sourceText.length<80){
      setNotice("بۆ هەڵبژاردنی وتە، پێویستە دەقی ڕاستەقینەی کتێب لە ئامێرەکە هەبێت.");
      return;
    }
    if(!aiConfig.apiKey.trim()){setNotice("بۆ دروستکردنی وتە بە AI، API Key زیاد بکە.");setSettingsOpen(true);return;}
    setQuoteBusy(true);
    try{
      const prompt=[
        "لە دەقی ڕاستەقینەی ئەم کتێبەدا تا 10 وتەی بەسوود هەڵبژێرە.",
        "وتەکان دەبێت بە وشە بە وشە لە دەقی سەرچاوە وەربگیرێن؛ هیچ وتەیەک دروست مەکە و paraphrase مەکە.",
        "هەر وتەیەک لە 240 پیت زیاتر نەبێت.",
        "بۆ هەر وتەیەک وەرگێڕانی سۆرانیی سروشتی بدە.",
        "تەنها JSON ـی ڕاستەوخۆ بنێرە بە شێوەی array ـی ئەم جۆرە: [{\"original\":\"...\",\"ku\":\"...\"}]. هیچ دەقی دەرەکی مەنووسە.",
        "",
        "کتێب: "+selected.title,
        "نووسەر: "+selected.author,
        "",
        "دەقی کتێب:",
        sourceText.slice(0,32000)
      ].join("\n");
      const raw=await askAI(aiConfig,prompt,3000);
      const match=raw.match(/\[[\s\S]*\]/);
      if(!match)throw new Error("AI وەڵامی JSON ـی دروستی نەدا.");
      const parsed=JSON.parse(match[0]);
      if(!Array.isArray(parsed))throw new Error("فۆرماتی وتەکان دروست نییە.");
      const items:Quote[]=parsed.slice(0,10).filter((x:any)=>x&&typeof x.original==="string"&&x.original.trim()).map((x:any,i:number)=>({
        id:`aiquote-${selected.id}-${Date.now()}-${i}`,
        textOriginal:x.original.trim(),
        textKu:typeof x.ku==="string"&&x.ku.trim()?x.ku.trim():x.original.trim(),
        author:selected.author,
        authorId:selected.author,
        source:"AI extraction from imported book text",
        sourceUrl:selected.sourceUrl,
        rights:selected.rights
      }));
      if(!items.length)throw new Error("هیچ وتەی ڕاستەقینە دۆزرایەوە.");
      await saveQuotes(items);
      setQuotes(prev=>[...items,...prev]);
      setNotice(items.length+" وتە بە سەرکەوتوویی هەڵگیرا ✓");
    }catch(e:any){
      setNotice("هەڵبژاردنی وتە سەرکەوتوو نەبوو: "+(e?.message||"هەڵە"));
    }finally{setQuoteBusy(false);}
  }

  async function fetchInternetSummary(){
    if(!selected){setNotice("سەرەتا کتێبێک هەڵبژێرە.");return;}
    if(!aiConfig.apiKey.trim()){setNotice("بۆ وەرگێڕان، سەرەتا API Key لە ⚙️ ڕێکخستنەکان زیاد بکە.");setSettingsOpen(true);return;}
    setTranslationBusy(true);
    setNotice("پوختە لە ئینتەرنێت دەگەڕێم…");
    try{
      const q=encodeURIComponent((selected.title+" "+(selected.author||"")).trim());
      const response=await fetch("https://www.googleapis.com/books/v1/volumes?q="+q+"&maxResults=5");
      if(!response.ok)throw new Error("internet search failed");
      const data=await response.json();
      const item=(data.items||[]).find((x:any)=>x.volumeInfo?.description);
      const info=item?.volumeInfo;
      if(!info?.description)throw new Error("پوختەیەکی گونجاو نەدۆزرایەوە.");
      const sourceSummary=String(info.description).replace(/<[^>]+>/g," ").trim().slice(0,12000);
      const prompt=[
        "ئەم پوختەیەی کتێبە لە سەرچاوەی ئینتەرنێت وەرگیراوە.",
        "بە مانای سەرەکییەکەی پابەند بە وەرگێڕانی سۆرانیی سروشتی و ڕوون بیگۆڕە.",
        "هیچ زانیارییەکی نوێ زیاد مەکە و ناوەڕۆکەکە دروست مەکە.",
        "تەنها دەقی پوختەی سۆرانی بنووسە.",
        "",
        "ناوی کتێب: "+selected.title,
        "نووسەر: "+selected.author,
        "",
        "پوختەی سەرچاوە:",
        sourceSummary
      ].join("\n");
      const translated=(await askAI(aiConfig,prompt,2200)).trim();
      if(!translated)throw new Error("AI وەڵامی بەتاڵی دا.");
      const itemSummary:Summary={
        id:"internet-summary-"+selected.id+"-"+Date.now(),
        bookId:selected.id,
        title:selected.title,
        textOriginal:sourceSummary,
        textKu:translated,
        source:"Google Books · internet summary",
        sourceUrl:info.infoLink || ("https://books.google.com/books?q="+q),
        wordCount:translated.split(/\s+/).filter(Boolean).length
      };
      await saveSummaries([itemSummary]);
      setSummaries(prev=>[itemSummary,...prev.filter(s=>s.bookId!==selected.id)]);
      setBooks(prev=>prev.map(b=>b.id===selected.id?{...b,summary:sourceSummary,summaryKu:translated}:b));
      setSelected(prev=>prev&&prev.id===selected.id?{...prev,summary:sourceSummary,summaryKu:translated}:prev);
      setNotice("پوختەی ئینتەرنێت وەرگێڕدرا و بۆ خوێندنەوەی ئۆفلاین هەڵگیرا ✓");
    }catch(e:any){
      setNotice(e?.message||"نەتوانرا پوختەی ئینتەرنێت بهێنرێت.");
    }finally{setTranslationBusy(false);}
  }

  async function saveAndTestAI(){
    try{
      await testAIConfig(aiConfig);
      setNotice("کلیلی API دروستە ✓");
    }catch(e:any){setNotice(e?.message||"تاقیکردنەوە سەرکەوتوو نەبوو");}
  }

  async function openBook(book:Book){
    // Enter the reader immediately. File loading and offline caching happen in the background.
    setSelected(book);
    setDetailsOpen(false);
    setReaderJump(undefined);
    setReaderPage(1);
    setFileUrl(null);

    // Load reading state in parallel; it must never block opening the reader.
    void getBookState(book.id).then(s=>setStates(x=>({...x,[book.id]:s}))).catch(()=>{});

    // If a remote URL exists, give the reader the URL immediately. Cache it afterwards.
    if(book.filePath && /^https?:\/\//.test(book.filePath)){
      const remoteUrl=book.filePath;
      setFileUrl(remoteUrl);
      void (async()=>{
        try{
          if(!remoteUrl) throw new Error("missing remote URL");
          const response=await fetch(remoteUrl);
          if(!response.ok) throw new Error("download failed");
          const blob=await response.blob();
          await saveBook(book,blob);
          if(book.format==="pdf") void extractPdfText(blob,book.id,setExtractedText,()=>{});
          if(book.format==="txt"||book.format==="html"){
            const raw=await blob.text();
            const text=book.format==="html"?raw.replace(/<[^>]+>/g," "):raw;
            (window as any).__kurdishLibraryText={...(window as any).__kurdishLibraryText,[book.id]:text};
            await saveExtractedText(book.id,text);
            setExtractedText(x=>({...x,[book.id]:text}));
          }
        }catch{
          // The reader has already opened; only show an error if the remote document cannot load.
          setNotice("فایلی کتێبەکە لە سەرچاوەکە بەردەست نییە");
        }
      })();
      return;
    }

    // Local/imported files are opened from IndexedDB without waiting for any other operation.
    try{
      const blob=await getBookFile(book.id);
      if(!blob){setNotice("فایلی کتێبەکە نەدۆزرایەوە");return;}
      const objectUrl=URL.createObjectURL(blob);
      setFileUrl(objectUrl);
      if(book.format==="pdf") void extractPdfText(blob,book.id,setExtractedText,setNotice);
      if(book.format==="txt"||book.format==="html"){
        const raw=await blob.text();
        const text=book.format==="html"?raw.replace(/<[^>]+>/g," "):raw;
        (window as any).__kurdishLibraryText={...(window as any).__kurdishLibraryText,[book.id]:text};
        await saveExtractedText(book.id,text);
        setExtractedText(x=>({...x,[book.id]:text}));
      }
    }catch{
      setNotice("نەتوانرا فایلەکە بکرێتەوە");
    }
  }
  function closeReader(){ if(fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(null); setSelected(null); }
  async function toggle(key:"favorite"|"bookmark"){
    if(!selected)return;
    const current=states[selected.id] ?? await getBookState(selected.id);
    const next=!current[key];
    await saveBookState(selected.id,{[key]:next,...(key==="bookmark"&&next?{bookmarkPage:readerPage}:{})});
    setStates(x=>({...x,[selected.id]:{...current,[key]:next,...(key==="bookmark"&&next?{bookmarkPage:readerPage}:{})}}));
    setNotice(next ? "پاشەکەوت کرا ✓" : "لابرا");
  }
  async function note(){
    if(!selected)return;
    const current=states[selected.id] ?? await getBookState(selected.id);
    const value=window.prompt("تێبینییەک بنووسە",current.note)||"";
    await saveBookState(selected.id,{note:value});
    setStates(x=>({...x,[selected.id]:{...current,note:value}}));
    setNotice("تێبینی پاشەکەوت کرا ✓");
  }
  async function addHighlight(){
    if(!selected) return;
    const selection=window.getSelection();
    const text=selection?.toString().trim() || prompt("دەقی highlight بنووسە")?.trim();
    if(!text) return;
    const page=readerPage>0?readerPage:undefined;
    const noteText=window.prompt("تێبینی بۆ ئەم highlight ـە (ئاختیاری):","")?.trim() || undefined;
    const item:Highlight={id:`hl-${Date.now()}`,bookId:selected.id,page,text,note:noteText,color:"yellow",createdAt:Date.now()};
    await saveHighlight(item); setHighlights(x=>[item,...x]);
    selection?.removeAllRanges();
    setNotice(page? `Highlight ـی لاپەڕەی ${page} پاشەکەوت کرا ✓` : "Highlight پاشەکەوت کرا ✓");
  }
  async function removeHighlight(id:string){await deleteHighlight(id);setHighlights(x=>x.filter(h=>h.id!==id));}
  async function runOcr(){
    if(!selected || selected.format!=="pdf") return;
    const blob=await getBookFile(selected.id); if(!blob){setNotice("فایلی بۆ OCR نییە");return;}
    setOcrBusy(true); setNotice("OCR دەستی پێکردووە…");
    // Kurdish traineddata is used so OCR is not silently limited to Arabic.
    try{
      const { createWorker }=await import("tesseract.js");
      const worker=await createWorker("kur");
      const pdf=await pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;
      const pages:string[]=[];
      const limit=Math.min(pdf.numPages,30);
      for(let n=1;n<=limit;n++){
        const page=await pdf.getPage(n); const viewport=page.getViewport({scale:1.5});
        const canvas=document.createElement("canvas"); canvas.width=viewport.width; canvas.height=viewport.height;
        await page.render({canvasContext:canvas.getContext("2d")!,canvas,viewport}).promise;
        const result=await worker.recognize(canvas); pages.push(result.data.text);
      }
      await worker.terminate(); await pdf.destroy();
      const text=pages.join("\n\n"); setExtractedText(x=>({...x,[selected.id]:text})); await saveExtractedText(selected.id,text);
      setNotice("OCR تەواو بوو ✓");
    }catch{ setNotice("OCR سەرکەوتوو نەبوو"); }
    finally{setOcrBusy(false);}
  }
  function speak(){
    if(!selected)return;
    const text=selected.summaryKu||selected.summary||selected.title;
    if("speechSynthesis" in window){ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang="ku"; u.rate=.9; window.speechSynthesis.speak(u); setNotice("خوێندنەوە دەستی پێکرد"); }
    else setNotice("TTS لەم ئامێرەدا بەردەست نییە");
  }
  async function searchGutenberg(){
    const q=internetQuery.trim();
    if(!q){setNotice("ناوی کتێب یان نووسەر بنووسە.");return;}
    setInternetBusy(true);
    try{
      const tasks:Promise<any[]>[]=[];
      if(internetSource==="all"||internetSource==="gutenberg"){
        tasks.push(fetch("https://gutendex.com/books?search="+encodeURIComponent(q)).then(async r=>{if(!r.ok)throw new Error("Gutenberg");const d=await r.json();return (Array.isArray(d?.results)?d.results:[]).map((x:any)=>({...x,_source:"gutenberg"}));}));
      }
      if(internetSource==="all"||internetSource==="openlibrary"){
        tasks.push(fetch("https://openlibrary.org/search.json?q="+encodeURIComponent(q)+"&limit=12").then(async r=>{if(!r.ok)throw new Error("Open Library");const d=await r.json();return (Array.isArray(d?.docs)?d.docs:[]).map((x:any)=>({...x,_source:"openlibrary"}));}));
      }
      if(internetSource==="all"||internetSource==="archive"){
        tasks.push(fetch("https://archive.org/advancedsearch.php?q="+encodeURIComponent(q)+"&fl[]=identifier,title,creator,description,mediatype,publicdate&rows=12&page=1&output=json").then(async r=>{if(!r.ok)throw new Error("Internet Archive");const d=await r.json();return (Array.isArray(d?.response?.docs)?d.response.docs:[]).map((x:any)=>({...x,_source:"archive"}));}));
      }
      const parts=await Promise.allSettled(tasks);
      const merged=parts.flatMap((p:any)=>p.status==="fulfilled"?p.value:[]);
      setInternetBooks(merged);
      setNotice(merged.length+" ئەنجام لە سەرچاوەکانی ئینتەرنێت دۆزرایەوە ✓");
    }catch(e:any){setInternetBooks([]);setNotice(e?.message||"گەڕانی ئینتەرنێت سەرکەوتوو نەبوو.");}
    finally{setInternetBusy(false);}
  }

  function gutenbergFormat(book:any){
    const f=book?.formats||{};
    const pick=(keys:string[])=>keys.map(k=>f[k]).find((u:any)=>typeof u==="string"&&/^https?:\/\//.test(u))||"";
    return {
      url:pick(["application/epub+zip","text/plain; charset=utf-8","text/plain","text/html; charset=utf-8","text/html"]),
      format:f["application/epub+zip"]?"epub":(f["text/plain; charset=utf-8"]||f["text/plain"])?"txt":"html"
    };
  }

  async function importGutenbergBook(item:any){
    const id=Number(item?.id||0); if(!id)return;
    if(item?.copyright===true){setNotice("ئەم کتێبە copyright ـی هەیە و خۆکارانە ناهێنرێت.");return;}
    const chosen=gutenbergFormat(item);
    if(!chosen.url){setNotice("فۆرماتی خوێندنەوەی گونجاو نەدۆزرایەوە.");return;}
    setInternetImporting(id);
    try{
      const response=await fetch(chosen.url);
      if(!response.ok)throw new Error("داگرتنی کتێب سەرکەوتوو نەبوو");
      const blob=await response.blob();
      const title=String(item.title||"Gutenberg "+id).replace(/\s+/g," ").trim();
      const author=String(item.authors?.[0]?.name||"Unknown");
      const book:Book={
        id:"gutenberg-"+id,title,author,
        category:String(item.subjects?.[0]||"کلاسیک"),
        language:String(item.languages?.[0]||"en"),
        format:chosen.format as Book["format"],
        fileName:title+"."+chosen.format,sizeBytes:blob.size,addedAt:Date.now(),
        source:"import",sourceUrl:"https://www.gutenberg.org/ebooks/"+id,
        rights:"Project Gutenberg catalog reports no current US copyright restriction; verify applicable local rights before redistribution."
      };
      await saveBook(book,blob);
      setBooks(prev=>[book,...prev.filter(x=>x.id!==book.id)]);
      setNotice("کتێبەکە هێنرا بۆ کتێبخانە ✓");
      openBook(book);
    }catch(e:any){setNotice(e?.message||"نەتوانرا کتێبەکە بهێنرێت.");}
    finally{setInternetImporting(null);}
  }

  async function importFiles(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[]);
    for(const file of files){
      const ext=file.name.split(".").pop()?.toLowerCase()||"";
      if(!["pdf","epub","txt","html","htm"].includes(ext)){ setNotice("ئەم جۆرە فایلە پشتگیری ناکرێت"); continue; }
      const id="import-"+crypto.randomUUID();
      const book:Book={id,title:file.name.replace(/\.[^.]+$/,""),author:"نەناسراو",category:"هاوردەکراو",language:"کوردی",format:ext==="htm"?"html":ext as Book["format"],fileName:file.name,sizeBytes:file.size,addedAt:Date.now(),source:"import"};
      await saveBook(book,file); setBooks(prev=>[book,...prev]);
    }
    if(files.length)setNotice("کتێبەکان زیاد کران ✓");
    e.target.value="";
  }  async function importDataPack(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      const incomingBooks:Array<Book>=Array.isArray(data.books)?data.books:[];
      const incomingSummaries:Array<Summary>=Array.isArray(data.summaries)?data.summaries:[];
      const incomingQuotes:Array<Quote>=Array.isArray(data.quotes)?data.quotes:[];
      const incomingAuthors:Array<Author>=Array.isArray(data.authors)?data.authors:[];
      if(incomingBooks.length) await Promise.all(incomingBooks.map(b=>saveBook({...b,source:b.source||"bundle",addedAt:b.addedAt||Date.now()})));
      if(incomingSummaries.length) await saveSummaries(incomingSummaries);
      if(incomingQuotes.length) await saveQuotes(incomingQuotes);
      if(incomingAuthors.length) await saveAuthors(incomingAuthors);
      const [bs,ss,qs,as]=await Promise.all([getBooks(),getSummaries(),getQuotes(),getAuthors()]);
      setBooks(bs);setSummaries(ss);setQuotes(qs);setAuthors(as);
      setNotice(`داتاپاک هاوردە کرا: ${incomingBooks.length} کتێب، ${incomingSummaries.length} پوختە ✓`);
    }catch{setNotice("داتاپاکی JSON دروست نییە");}
    e.target.value="";
  }

  const globalQ=query.trim().toLocaleLowerCase();
  const globalBooks=globalQ.length<2?[]:books.filter(b=>[b.title,b.author,b.category,b.summary,b.summaryKu,b.tags?.join(" ")].filter(Boolean).join(" ").toLocaleLowerCase().includes(globalQ)).slice(0,12);
  const globalSummaries=globalQ.length<2?[]:summaries.filter(s=>[s.title,books.find(b=>b.id===s.bookId)?.author,s.textKu,s.textOriginal].filter(Boolean).join(" ").toLocaleLowerCase().includes(globalQ)).slice(0,8);
  const globalQuotes=globalQ.length<2?[]:quotes.filter(q=>[q.textKu,q.textOriginal,q.author].filter(Boolean).join(" ").toLocaleLowerCase().includes(globalQ)).slice(0,8);
  function externalSearch(site:string){
    const q=encodeURIComponent(query.trim()); if(!q)return;
    const urls:Record<string,string>={anna:"https://annas-archive.gl/search?q="+q,libgen:"https://libgen.la/index.php?req="+q,openlibrary:"https://openlibrary.org/search?q="+q,archive:"https://archive.org/search?query="+q};
    const u=urls[site]; if(u) window.open(u,"_blank","noopener,noreferrer");
  }

  return <div className={"app "+theme+" font-"+font+(compact?" compact":"")} lang="ckb" dir="rtl">
    <header><div className="brand-area"><div className="brand">📚</div><div><h1>کتێبخانەی کوردی</h1><p>خوێندنەوەی سۆرانی — ئۆفلاین</p></div></div>
      <div className="top-actions"><button className="global-search-button" onClick={()=>setGlobalSearchOpen(true)} aria-label="گەڕانی گشتی">🔎 <span>گەڕان</span></button><label className="import">➕ هاوردەکردن<input hidden type="file" multiple accept=".pdf,.epub,.txt,.html,.htm" onChange={importFiles}/></label>
      <label className="import">🗂️ داتاپاک<input hidden type="file" accept=".json,application/json" onChange={importDataPack}/></label><button onClick={()=>setAiOpen(true)}>🤖 AI</button><button onClick={()=>setSettingsOpen(true)}>⚙️</button><button onClick={()=>setTheme(theme==="light"?"dark":theme==="dark"?"sepia":theme==="sepia"?"eink":"light")}>{theme==="light"?"☀️":theme==="dark"?"🌙":theme==="sepia"?"📜":"📄"}</button></div></header>
    <main>
      {globalSearchOpen&&<div className="modal global-search-modal" onClick={()=>setGlobalSearchOpen(false)}>
        <section className="global-search-panel" onClick={e=>e.stopPropagation()}>
          <div className="reader-head"><div><strong>🔎 گەڕانی گشتی</strong><small>کتێب، پوختە، وتە و کتێبە هاوردەکراوەکان</small></div><button onClick={()=>setGlobalSearchOpen(false)}>✕</button></div>
          <input autoFocus className="global-search-input" placeholder="ناوی کتێب، نووسەر، وشەیەک یان بابەت..." value={query} onChange={e=>setQuery(e.target.value)}/>
          {globalQ.length>=2?<div className="global-search-results">
            <div className="search-result-group"><h3>📚 کتێبەکان ({globalBooks.length})</h3>{globalBooks.map(b=><button key={b.id} onClick={()=>{setGlobalSearchOpen(false);openBook(b)}}><strong>{b.title}</strong><small>{b.author} · {b.format.toUpperCase()}</small></button>)}{!globalBooks.length&&<p>هیچ کتێبێکی ناوخۆ نەدۆزرایەوە.</p>}</div>
            <div className="search-result-group"><h3>✨ پوختەکان ({globalSummaries.length})</h3>{globalSummaries.map(s=><article key={s.id}><strong>{s.title}</strong><p>{s.textKu.slice(0,240)}{s.textKu.length>240?"…":""}</p></article>)}{!globalSummaries.length&&<p>پوختەی هاوتا نەدۆزرایەوە.</p>}</div>
            <div className="search-result-group"><h3>💬 وتەکان ({globalQuotes.length})</h3>{globalQuotes.map(q=><article key={q.id}><blockquote>“{q.textKu}”</blockquote><small>{q.author}</small></article>)}{!globalQuotes.length&&<p>وتەی هاوتا نەدۆزرایەوە.</p>}</div>
            <div className="search-result-group external-search"><h3>🌐 گەڕان لە دەرەوە</h3><p>هەمان وشە لە سایتەکانی دەرەوە دەگەڕێت.</p><div className="external-search-grid"><button onClick={()=>externalSearch("anna")}>📚 Anna's Archive</button><button onClick={()=>externalSearch("libgen")}>📖 Library Genesis</button><button onClick={()=>externalSearch("openlibrary")}>🌐 Open Library</button><button onClick={()=>externalSearch("archive")}>🏛️ Internet Archive</button></div></div>
          </div>:<div className="global-search-empty"><span>🔎</span><strong>گەڕان دەست پێ بکە</strong><p>لە کتێبەکانی ناو مۆبایل، پوختە و وتەکاندا دەگەڕێت؛ هەروەها دەتوانیت هەمان گەڕان لە سایتەکانی دەرەوە بکەیت.</p></div>}
        </section>
      </div>}
      <nav className="main-nav" aria-label="بەشەکانی ئەپ">
        <button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><span className="nav-icon">⌂</span><span>سەرەتا</span></button>
        <button className={tab==="library"?"active":""} onClick={()=>setTab("library")}><span className="nav-icon">▦</span><span>کتێبخانە</span></button>
        <button className={tab==="summaries"?"active":""} onClick={()=>setTab("summaries")}><span className="nav-icon">✦</span><span>پوختەکان</span></button>
        <button className={tab==="quotes"?"active":""} onClick={()=>setTab("quotes")}><span className="nav-icon">❝</span><span>وتەکان</span></button>
        <button className={tab==="favorites"?"active":""} onClick={()=>setTab("favorites")}><span className="nav-icon">♡</span><span>دڵخوازەکان</span></button>
        <button className={tab==="media"?"active":""} onClick={()=>setTab("media")}><span className="nav-icon">▶</span><span>میدیا</span></button>
        <button className={tab==="internet"?"active":""} onClick={()=>setTab("internet")}><span className="nav-icon">🌐</span><span>ئینتەرنێت</span></button>
        <button onClick={()=>setNotebookOpen(true)}><span className="nav-icon">▤</span><span>تۆمار</span></button>
      </nav>
      <div className="ai-fab-wrap">
        <button className={`ai-fab ${aiBusy?"busy":""}`} onClick={()=>{if(!aiConfig.apiKey.trim()){setSettingsOpen(true);setNotice("API Key زیاد بکە بۆ بەکارهێنانی AI.");return;}setAiOpen(true);}} aria-label="یاریدەدەری AI" title="یاریدەدەری AI">
          <span className="ai-fab-icon">✦</span><span className="ai-fab-badge">AI</span>
        </button>
        <div className="ai-fab-actions"><button className="ai-fab-summary" onClick={()=>void summarizeSelectedBook()} disabled={aiBusy} aria-label="پوختەکردنەوەی کتێب">{aiBusy?"⏳":"📝"} <span>پوختە</span></button><button className="ai-fab-summary ai-fab-translate" onClick={()=>void translateSelectedBook()} disabled={aiBusy} aria-label="کوردیکردنی کتێب">🌐 <span>کوردی</span></button></div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="گەشتکردن">
        <button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><span className="nav-icon">⌂</span><small>سەرەتا</small></button>
        <button className={tab==="library"?"active":""} onClick={()=>setTab("library")}><span className="nav-icon">▦</span><small>کتێبخانە</small></button>
        <button className={tab==="summaries"?"active":""} onClick={()=>setTab("summaries")}><span className="nav-icon">✦</span><small>پوختە</small></button>
        <button className={tab==="quotes"?"active":""} onClick={()=>setTab("quotes")}><span className="nav-icon">❝</span><small>وتە</small></button>
        <button className={tab==="internet"?"active":""} onClick={()=>setTab("internet")}><span className="nav-icon">🌐</span><small>ئینتەرنێت</small></button>
        <button onClick={()=>setSettingsOpen(true)}><span className="nav-icon">☰</span><small>زیاتر</small></button>
      </nav>
<section className="hero"><div><div className="eyebrow">KURDISH LIBRARY • OFFLINE</div><h2>هەموو کتێبەکانت لە یەک شوێن</h2><p>گەڕان، خوێندنەوە، پاشەکەوتکردن و خوێندنەوەی PDF/EPUB بە شێوەی ئۆفلاین.</p></div><div className="stats"><strong>{books.length}</strong><span>کتێب</span><strong>{summaries.length}</strong><span>پوختەی سۆرانی</span><strong>{sourceManifest?.total||0}</strong><span>سەرچاوە</span><strong>{filtered.length}</strong><span>ئەنجام</span></div><input className="search" placeholder="گەڕان بە ناوی کتێب، نووسەر یان ناوەڕۆک..." value={query} onChange={e=>setQuery(e.target.value)}/></section>
      <nav className="chips">{categories.map(x=><button className={category===x?"active":""} onClick={()=>setCategory(x)} key={x}>{x}</button>)}</nav>
      <section className="home-tools"><button onClick={()=>setSettingsOpen(true)}>⚙️ ڕێکخستنەکان</button><span className="view-label">پیشاندان:</span>{(["grid","shelf","list","small"] as const).map(v=><button key={v} className={viewMode===v?"active-tool":""} onClick={()=>setViewMode(v)}>{v==="grid"?"▦ گرید":v==="shelf"?"▤ ڕەف":v==="list"?"☰ لیست":"▪ ئایکۆنی بچوک"}</button>)}<button onClick={()=>setNotice("بەشی پوختە و وتەکان بۆ داتای ئۆفلاین ئامادە کراوە")}>✨ پوختە و وتەکان</button><button onClick={()=>setNotice("Ink Reader: بۆ PDF لە خوێندنەوەدا چالاکی بکە")}>🖋️ Ink Reader</button></section>
      {tab==="home"&&<section className="home-hub" aria-label="بەشەکانی کتێبخانە"><div className="section-heading"><div><span className="eyebrow">KURDISH LIBRARY</span><h2>هەموو بەشەکان</h2></div><small>یەک کلیک بۆ چوونە ناو هەر بەشێک</small></div><div className="home-hub-grid"><button className="hub-card" onClick={()=>setTab("library")}><span className="hub-icon">📚</span><strong>کتێبخانە</strong><small>{books.length} کتێب</small></button><button className="hub-card" onClick={()=>setTab("summaries")}><span className="hub-icon">✨</span><strong>پوختەکان</strong><small>{summaries.length?`${summaries.length} پوختە`:"پوختەی کتێبەکان"}</small></button><button className="hub-card" onClick={()=>setTab("quotes")}><span className="hub-icon">💬</span><strong>وتەکان</strong><small>{quotes.length?`${quotes.length} وتە`:"وتەی هەڵبژێردراو"}</small></button><button className="hub-card" onClick={()=>setTab("favorites")}><span className="hub-icon">❤️</span><strong>دڵخوازەکان</strong><small>{favoriteBooks.length} کتێب</small></button><button className="hub-card" onClick={()=>setNotebookOpen(true)}><span className="hub-icon">🗒️</span><strong>تۆمار و تێبینی</strong><small>{notes.length} تێبینی</small></button><button className="hub-card" onClick={()=>setTab("media")}><span className="hub-icon">🎬</span><strong>میدیای پلەیەر</strong><small>دەنگ و ڤیدیۆ</small></button></div></section>}
      {tab==="home"&&<>{resumeBooks.length>0&&<section className="resume-panel"><h2>↩️ بەردەوامبوون لە خوێندنەوە</h2><div className="resume-row">{resumeBooks.map(b=><button key={b.id} onClick={()=>openBook(b)}><strong>{b.title}</strong><small>{Math.round((states[b.id]?.progress||0)*100)}% خوێندراوەتەوە</small></button>)}</div></section>}</>}
      {tab==="summaries"&&<section className="content-panel"><h2>✨ پوختەی کتێبەکان</h2><p>پوختەکان لە ناوخۆی ئامێر هەڵدەگیرێن و بۆ گەڕان و خوێندنەوەی ئۆفلاین بەکاردێن.</p>{summaries.length?<><div className="content-list">{pagedSummaries.map(s=><article key={s.id}><h3>{s.title}</h3><p>{s.textKu}</p><small>{s.wordCount?`ژمارەی وشە: ${s.wordCount} · `:""}{s.source||"داتای ئۆفلاین"}</small></article>)}</div><PageControls page={safeSummaryPage} total={totalSummaryPages} onChange={setSummaryPage}/></>:<div className="empty-state"><strong>هێشتا پوختەی ئۆفلاین نییە.</strong><p>داتاپاکی JSON لە دوگمەی «داتاپاک» هاوردە بکە؛ دواتر پوختەکان لێرە و لە گەڕانی کتێبەکاندا دەردەکەون.</p></div>}</section>}
      {tab==="quotes"&&<section className="content-panel"><h2>💬 وتەکان</h2>{quotes.length?<div className="quote-list">{quotes.map(q=><article key={q.id}><blockquote>“{q.textKu}”</blockquote><strong>{q.author}</strong></article>)}</div>:<p>هێشتا وتەی ئۆفلاین زیاد نەکراوە. سیستەمی داتا ئامادەیە بۆ کۆمەڵەی زۆرتر.</p>}</section>}
      {tab==="media"&&<MediaPlayer/>}
      {tab==="internet"&&<section className="internet-library">
        <div className="internet-hero">
          <div><span className="internet-icon">🌐</span><div><h2>کتێب لە ئینتەرنێت</h2><p>لە چەند سەرچاوەی یاسایی و ناسراو بگەڕێ؛ کتێبە گونجاوەکانی Project Gutenberg دەتوانرێن بۆ خوێندنەوەی ئۆفلاین بهێنرێن.</p></div></div>
          <div className="internet-source-tabs">
            {([["all","هەموو"],["gutenberg","Gutenberg"],["openlibrary","Open Library"],["archive","Internet Archive"]] as const).map(([key,label])=><button key={key} className={internetSource===key?"active":""} onClick={()=>setInternetSource(key)}>{label}</button>)}
          </div>
          <div className="internet-search"><input value={internetQuery} onChange={e=>setInternetQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void searchGutenberg()}} placeholder="ناوی کتێب یان نووسەر..." /><button onClick={()=>void searchGutenberg()} disabled={internetBusy}>{internetBusy?"گەڕان…":"🔎 گەڕان"}</button></div>
          <small>Gutenberg: دۆخی public-domain لە کاتالۆگی ئەم سەرچاوەیەدا پشکنراوە. Open Library و Internet Archive زانیاری/سەرچاوە پیشان دەدەن؛ مافی بەکارهێنان بە پێی یاسای ناوچەکەت پشکنین بکە.</small>
        </div>
        <div className="internet-results">
          {!internetBooks.length&&!internetBusy&&<div className="internet-empty">📚<strong>کتێبێک بگەڕێ</strong><span>بۆ نموونە: Pride and Prejudice، Sherlock Holmes، Shakespeare</span></div>}
          {internetBooks.map((item:any)=>{
            const source=item._source;
            if(source==="gutenberg"){
              const chosen=gutenbergFormat(item), imported=books.some(b=>b.id==="gutenberg-"+item.id);
              return <article className="internet-book" key={"g-"+item.id}>
                <div className="internet-cover">{item.formats?.["image/jpeg"]?<img src={item.formats["image/jpeg"]} alt="" loading="lazy"/>:"📖"}</div>
                <div className="internet-book-body"><h3>{item.title}</h3><p>{item.authors?.map((a:any)=>a.name).join("، ")||"نووسەر نەناسراو"}</p>
                  <div className="internet-meta"><span>Gutenberg</span><span>{item.languages?.join("، ")||"en"}</span>{item.copyright===false?<span>Public Domain (US)</span>:<span>ماف پشکنین بکە</span>}</div>
                  <div className="internet-actions"><button onClick={()=>window.open("https://www.gutenberg.org/ebooks/"+item.id,"_blank","noopener,noreferrer")}>🌐 سەیری سەرچاوە</button><button disabled={!chosen.url||item.copyright===true||internetImporting===item.id||imported} onClick={()=>void importGutenbergBook(item)}>{internetImporting===item.id?"هێنان…":imported?"✓ لە کتێبخانەیە":"⬇️ هێنان بۆ کتێبخانە"}</button></div>
                </div>
              </article>;
            }
            if(source==="openlibrary"){
              const title=String(item.title||"کتێبی Open Library"), author=String(item.author_name?.slice?.(0,3)?.join("، ")||"نووسەر نەناسراو"), key=String(item.key||"").replace(/^\//,"");
              return <article className="internet-book" key={"ol-"+(item.key||item.title)}>
                <div className="internet-cover">📚</div><div className="internet-book-body"><h3>{title}</h3><p>{author}</p><div className="internet-meta"><span>Open Library</span><span>{item.first_publish_year||"ساڵ نەزانراو"}</span>{item.public_scan_b||item.ia?.length?<span>سکان/ئەرشیف هەیە</span>:<span>زانیاری کتێب</span>}</div><div className="internet-actions"><button onClick={()=>window.open("https://openlibrary.org/"+key,"_blank","noopener,noreferrer")}>🌐 سەیری سەرچاوە</button></div></div>
              </article>;
            }
            const id=String(item.identifier||"");
            return <article className="internet-book" key={"ia-"+id}>
              <div className="internet-cover">🗄️</div><div className="internet-book-body"><h3>{String(item.title||id)}</h3><p>{Array.isArray(item.creator)?item.creator.join("، "):String(item.creator||"نووسەر نەناسراو")}</p><div className="internet-meta"><span>Internet Archive</span><span>{item.publicdate||"ساڵ نەزانراو"}</span><span>{item.mediatype||"item"}</span></div><div className="internet-actions"><button onClick={()=>window.open("https://archive.org/details/"+encodeURIComponent(id),"_blank","noopener,noreferrer")}>🌐 سەیری سەرچاوە</button></div></div>
            </article>;
          })}
        </div>
      </section>}
      {tab!=="media"&&<section className="notebook-launch"><button onClick={()=>setNotebookOpen(true)}>🗒️ تۆمار و تێبینییەکان</button><span>{Object.values(states).filter(s=>s.note).length} تێبینی</span></section>}{tab!=="summaries"&&tab!=="quotes"&&tab!=="media"&&tab!=="internet"&&<section className={`grid view-${viewMode}`}>{pagedBooks.map(b=><article className="card" key={b.id} onClick={()=>openBook(b)}><div className="cover">{b.coverPath?<img src={b.coverPath} alt="" loading="lazy"/>:b.format==="pdf"?"📕":b.format==="epub"?"📘":"📖"}</div><div className="card-body"><small>{b.category} · {b.format.toUpperCase()}</small><h3>{b.title}</h3><p>{b.author}</p><span>{b.summaryKu||b.summary||"کلیک بکە بۆ خوێندنەوە."}</span>{states[b.id]?.progress>0&&<div className="book-progress"><i style={{width:`${Math.round((states[b.id]?.progress||0)*100)}%`}}/></div>}</div></article>)}</section>}{tab!=="summaries"&&tab!=="quotes"&&tab!=="media"&&tab!=="internet"&&<PageControls page={safeLibraryPage} total={totalLibraryPages} onChange={setLibraryPage}/>}

      {selected&&detailsOpen&&<div className="modal" onClick={()=>setDetailsOpen(false)}><div className="book-details" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author}</small></div><button onClick={()=>setDetailsOpen(false)}>✕</button></div><div className="book-details-grid"><div className="detail-cover">{selected.coverPath?<img src={selected.coverPath} alt="" />:<div>{selected.format==="pdf"?"📕":selected.format==="epub"?"📘":"📖"}</div>}</div><div><h2>{selected.title}</h2><p className="author-line">✍️ {selected.author}</p><p>📂 {selected.category} · {selected.language}</p><p>📄 {selected.format.toUpperCase()}</p>{selected.sizeBytes&&<p>💾 {(selected.sizeBytes/1024/1024).toFixed(1)} MB</p>}<div className="progress-line"><span style={{width:`${Math.round((states[selected.id]?.progress||0)*100)}%`}} /></div><small>{Math.round((states[selected.id]?.progress||0)*100)}% خوێندراوەتەوە</small></div></div>{(selected.summaryKu||selected.summary)&&<section className="detail-summary"><h3>✨ پوختە</h3><p>{selected.summaryKu||selected.summary}</p></section>}{summaries.filter(s=>s.bookId===selected.id).slice(0,1).map(s=><section className="detail-summary" key={s.id}><h3>✨ پوختەی ئۆفلاین</h3><p>{s.textKu}</p></section>)}<div className="detail-quotes">{quotes.filter(q=>q.author===selected.author||q.authorId===selected.author).slice(0,3).map(q=><blockquote key={q.id}>“{q.textKu}”<small>— {q.author}</small></blockquote>)}</div><div className="detail-actions"><button onClick={()=>{setDetailsOpen(false)}}>📖 خوێندنەوە</button><button onClick={fetchInternetSummary} disabled={translationBusy}>🌐 {translationBusy?"پوختە دەهێنرێت…":"هێنانی پوختەی ئینتەرنێت"}</button><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️ دڵخوازە":"🤍 زیادکردن بۆ دڵخواز"}</button><button onClick={()=>toggle("bookmark")}>🔖 نیشانە</button>{sourceIdSet.has(selected.id)&&!summaryIdSet.has(selected.id)&&<button onClick={translateSelectedSummary} disabled={translationBusy}>🌐 وەرگێڕینی پوختە</button>}{sourceIdSet.has(selected.id)&&summaryIdSet.has(selected.id)&&<span className="translated-badge">✅ پوختەی سۆرانی</span>}</div></div></div>}
      {selected&&!detailsOpen&&<div className="modal" onClick={closeReader}><div className="reader" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author} · {selected.format.toUpperCase()}</small></div><button onClick={closeReader}>✕</button></div>
      <ReaderContent book={selected} url={fileUrl} fontSize={fontSize} onProgress={v=>saveProgress(selected.id,v)} onNotice={setNotice} ink={readerMode==="ink"} split={split} initialProgress={states[selected.id]?.progress||0} onPage={p=>setReaderPage(p)} jumpPage={readerJump}/>
      <div className="reader-tools"><button className={readerMode==="ink"?"active-tool":""} onClick={()=>setReaderMode(readerMode==="ink"?"normal":"ink")}>🖋️ Ink</button><span>Split:</span>{([1,2,4] as const).map(n=><button key={n} className={split===n?"active-tool":""} onClick={()=>setSplit(n)}>{n}×</button>)}</div><div className="reader-foot"><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️":"🤍"} دڵخواز</button><button onClick={()=>toggle("bookmark")}>{states[selected.id]?.bookmark?"🔖":"📑"} نیشانە</button>{states[selected.id]?.bookmark&&<button onClick={()=>{setReaderJump(states[selected.id]?.bookmarkPage||1);setNotice(`گەڕانەوە بۆ لاپەڕەی ${states[selected.id]?.bookmarkPage||1}`)}}>↩️ گەڕانەوە بۆ نیشانە</button>}<button onClick={note}>📝 تێبینی</button><button onClick={speak}>🔊 خوێندنەوە</button><button onClick={addHighlight}>🖍️ Highlight</button>{selected.format==="pdf"&&<button onClick={runOcr} disabled={ocrBusy}>🔎 {ocrBusy?"OCR…":"OCR"}</button>}<button onClick={()=>setFontSize(v=>Math.min(30,v+2))}>A+</button><button onClick={()=>setFontSize(v=>Math.max(14,v-2))}>A−</button></div>
      </div></div>}
      {notebookOpen&&<div className="modal" onClick={()=>setNotebookOpen(false)}><div className="notebook notebook-pro" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>📓 دەفتەری تێبینی</strong><small>تێبینییەکان بە تەواوی لە ناوخۆی ئامێرەکەت هەڵدەگیرێن</small></div><button onClick={()=>setNotebookOpen(false)}>✕</button></div><div className="notebook-highlights">{selected&&highlights.filter(h=>h.bookId===selected.id).slice(0,12).map(h=><div key={h.id} className="highlight-item" role="button" tabIndex={0} onClick={()=>{if(h.page){const b=books.find(x=>x.id===h.bookId);if(b){setSelected(b);setDetailsOpen(false);setReaderJump(h.page);}setReaderPage(h.page);setNotice(`دەقی Highlight ـکراو لە لاپەڕەی ${h.page} ـە`)};setNoteTitle("Highlight");setNoteDraft(h.note ? '"' + h.text + '"\\n\\n' + h.note : '"' + h.text + '"');setNoteBookId(h.bookId);setActiveNoteId(null)}}><span>🖍️</span><strong>{h.text.slice(0,90)}</strong>{h.page&&<small>لاپەڕە {h.page}</small>}<button className="highlight-delete" onClick={e=>{e.stopPropagation();removeHighlight(h.id)}}>🗑️</button></div>)}</div><div className="notebook-toolbar"><input placeholder="گەڕان لە تێبینییەکان..." value={noteSearch} onChange={e=>setNoteSearch(e.target.value)}/><button onClick={()=>{const b=selected||books[0];if(!b)return;setNoteTitle("تێبینی نوێ");setNoteDraft("");setNoteBookId(b.id);setActiveNoteId(null)}}>＋ تێبینی نوێ</button></div><div className="notebook-grid"><aside className="notebook-list">{notes.filter(n=>{const b=books.find(x=>x.id===n.bookId);const q=noteSearch.toLocaleLowerCase();return (!q||`${n.title} ${n.body} ${b?.title||""}`.toLocaleLowerCase().includes(q))}).map(n=><article key={n.id} className={noteBookId===n.bookId&&noteTitle===n.title?"active":""}><button className="note-select" onClick={()=>{setNoteTitle(n.title);setNoteDraft(n.body);setNoteBookId(n.bookId);setActiveNoteId(n.id)}}><strong>{n.title||"بێ ناونیشان"}</strong><small>{books.find(b=>b.id===n.bookId)?.title||"کتێب"}</small><p>{n.body.slice(0,120)}</p></button><button className="danger" onClick={()=>removeNote(n.id)}>🗑️</button></article>)}{!notes.length&&<p>هێشتا هیچ تێبینییەک نییە.</p>}</aside><div className="notebook-editor"><input placeholder="ناونیشانی تێبینی" value={noteTitle} onChange={e=>setNoteTitle(e.target.value)}/><select value={noteBookId||selected?.id||""} onChange={e=>setNoteBookId(e.target.value)}>{books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select><textarea placeholder="تێبینییەک بنووسە..." value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} rows={14}/><div className="notebook-actions"><button onClick={()=>{const now=Date.now();const id=activeNoteId||("note-"+now);const existing=notes.find(n=>n.id===id);persistNote({id,bookId:noteBookId||selected?.id||books[0]?.id||"",title:noteTitle||"تێبینی",body:noteDraft,createdAt:existing?.createdAt||now,updatedAt:now})}}>💾 پاشەکەوتکردن</button><button onClick={()=>{const b=books.find(x=>x.id===noteBookId);if(b){setSelected(b);setDetailsOpen(true);setNotebookOpen(false)}}}>📖 کردنەوەی کتێب</button></div></div></div></div></div>}{aiOpen&&<div className="modal" onClick={()=>setAiOpen(false)}><div className="ai-assistant" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>🤖 یاریدەدەری AI</strong><small>{selected?selected.title:"کتێبێک هەڵبژێرە بۆ پرسیارکردن"}</small></div><div className="ai-head-actions">{aiThread.length>0&&<button onClick={()=>setAiThread([])}>پاککردنەوەی گفتوگۆ</button>}<button onClick={()=>setAiOpen(false)}>✕</button></div></div><div className="ai-chat"><div className="ai-panel-tabs"><button className={aiPanelTab==="chat"?"active":""} onClick={()=>setAiPanelTab("chat")}>💬 گفتوگۆ</button><button className={aiPanelTab==="summarize"?"active":""} onClick={()=>setAiPanelTab("summarize")}>📝 پوختەکردن</button><button className={aiPanelTab==="translate"?"active":""} onClick={()=>setAiPanelTab("translate")}>🌐 کوردیکردن</button></div>
{aiPanelTab==="chat"&&<div className="ai-quick"><button onClick={()=>askBookAI("پوختەیەکی ڕوون و ڕێکخراو لە بیرۆکە سەرەکییەکانی ئەم کتێبە بنووسە.")} disabled={aiBusy||!selected}>✨ پوختە</button><button onClick={()=>askBookAI("10 بیرۆکە یان فێربوونی گرنگی کتێبەکە بە خاڵ بنووسە.")} disabled={aiBusy||!selected}>💡 10 فێربوون</button><button onClick={()=>askBookAI("10 پرسیار و وەڵامی کورت لەسەر ناوەڕۆکی کتێبەکە دروست بکە.")} disabled={aiBusy||!selected}>❓ Q&A</button><button onClick={extractQuotesForSelectedBook} disabled={aiBusy||quoteBusy||!selected}>{quoteBusy?"⏳ وتەکان…":"💬 هەڵبژاردنی ١٠ وتە"}</button><button onClick={startStudyMode} disabled={aiBusy||studyBusy||!selected}>🎓 Study Mode</button></div>}
{aiPanelTab==="summarize"&&<div className="ai-action-card"><h3>📝 پوختەی کتێب بە کوردی</h3><p>{selected?"AI دەقی کتێبەکە و زانیاریی بەردەستی دەخوێنێتەوە و پوختەی سۆرانی دروست دەکات.":"سەرەتا کتێبێک هەڵبژێرە."}</p><button onClick={()=>void summarizeSelectedBook()} disabled={aiBusy||!selected}>✨ دروستکردنی پوختەی سۆرانی</button></div>}
{aiPanelTab==="translate"&&<div className="ai-action-card"><h3>🌐 وەرگێڕانی کتێب بۆ سۆرانی</h3><p>{selected?"AI بەشێک لە دەقی کتێبەکە وەردەگرێت و بە سۆرانی سروشتی دەیکات.":"سەرەتا کتێبێک هەڵبژێرە."}</p><button onClick={()=>void translateSelectedBook()} disabled={aiBusy||!selected}>🌐 وەرگێڕانی دەقی بەردەست</button></div>}<textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="پرسیارێک لەسەر کتێبەکە بنووسە..." rows={5}/><button className="ai-send" onClick={()=>{if(aiPrompt.trim())askBookAI(aiPrompt.trim())}} disabled={aiBusy||!selected||!aiPrompt.trim()}>{aiBusy?"⏳ AI خەریکی وەڵامدانەوەیە…":"➤ ناردن"}</button>{aiBusy&&<div className="ai-status">AI خەریکی کارکردنە…</div>}{aiThread.length?<div className="ai-thread" dir="rtl">{aiThread.map((m,i)=><div key={i} className={"ai-message "+(m.role==="user"?"user":"assistant")}><small>{m.role==="user"?"تۆ":"AI"}</small><div>{m.content}</div></div>)}</div>:aiResult&&<div className="ai-result" dir="rtl">{aiResult}</div>}</div><div className="ai-footer">بۆ بەکارهێنانی AI، API Key ـەکەت لە ⚙️ ڕێکخستنەکان زیاد بکە.</div>{studyOpen&&<div className="study-box"><div className="ai-history-head"><strong>🎓 Study Mode — {selected?.title||""}</strong><button onClick={()=>setStudyOpen(false)}>✕</button></div>{studyBusy?<div className="ai-status">خەریکی دروستکردنی وانە و پرسیارەکانە…</div>:<div className="ai-result" dir="rtl">{aiResult}</div>}</div>}<div className="ai-history"><div className="ai-history-head"><strong>🕘 مێژووی گفتوگۆ</strong>{selected&&aiHistory.filter(x=>x.bookId===selected.id).length>0&&<button onClick={async()=>{await clearAIHistory(selected.id);setAiHistory(await getAIHistory());setNotice("مێژووی AI ـی ئەم کتێبە سڕایەوە.");}}>پاککردنەوە</button>}</div>{(selected?aiHistory.filter(x=>x.bookId===selected.id):aiHistory).slice(0,8).map(x=><details key={x.id}><summary>{x.prompt.slice(0,100)}{x.prompt.length>100?"…":""}</summary><div className="ai-history-answer" dir="rtl">{x.answer}</div></details>)}</div></div></div>}{settingsOpen&&<div className="modal" onClick={()=>setSettingsOpen(false)}><div className="settings" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>⚙️ ڕێکخستنەکان</strong><small>ڕێکخستنی خوێندنەوە و شێوازی دەرکەوتن</small></div><button onClick={()=>setSettingsOpen(false)}>✕</button></div><div className="settings-grid"><label>شێوازی ڕووکار<select value={theme} onChange={e=>setTheme(e.target.value as "light"|"dark"|"sepia")}><option value="light">☀️ ڕووناک</option><option value="dark">🌙 تاریک</option><option value="sepia">📜 سێپیا</option><option value="eink">📄 E-ink</option></select></label><label>جۆری فۆنت<select value={font} onChange={e=>setFont(e.target.value)}><option value="system">سیستەم</option><option value="serif">Serif</option><option value="sans">Sans</option></select></label><label>قەبارەی نووسین: {fontSize}px<input type="range" min="14" max="30" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label><label><span>لیستی کورتتر</span><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label><div className="settings-section"><strong>📚 ئۆفلاین</strong><p>کتێبە هاوردەکراوەکان و پێشکەوتنی خوێندنەوە لە ناوخۆی ئامێرەکەت هەڵدەگیرێن.</p></div><div className="settings-section"><strong>🖋️ Ink Reader</strong><p>شێوازی grayscale بۆ خوێندنەوەی سادە و Split ـی 2× و 4× بۆ دابەشکردنی لاپەڕەی PDF بەکار دێت.</p></div>
<div className="settings-section google-settings"><strong>🔐 هەژماری Google</strong><p>هەژماری Google بۆ ناسینەوەی بەکارهێنەر بەکار دێت؛ API Key ـەکانی AI جیاوازن.</p><label>Google Web Client ID<input value={googleClientId} onChange={e=>setGoogleClientId(e.target.value)} placeholder="1234567890-xxxxx.apps.googleusercontent.com" autoComplete="off"/></label><button type="button" onClick={saveGoogleClientId}>💾 پاشەکەوتکردنی Client ID</button>{googleProfile?<div className="google-profile">{googleProfile.picture&&<img src={googleProfile.picture} alt="" />}<span>{googleProfile.name||googleProfile.email||"Google account"}</span><button onClick={googleSignOut}>دەرچوون</button></div>:<button onClick={googleSignIn} disabled={!googleClientId}>🔵 چوونەژوورەوە بە Google</button>}{!googleClientId&&<small>پێویستە Google Web Client ID ـی Web application لێرە دابنێیت یان لە build ـەکەدا ڕێکبخرێت.</small>}</div>
  <div className="settings-section content-studio">
    <strong>📦 ناوەڕۆکی سەرچاوە و وەرگێڕان</strong>
    <p>{sourceManifest?.total||0} سەرچاوەی پوختە لە APK ـدا هەیە؛ {translatedSourceCount} دانەیان بە سۆرانی پاشەکەوت کراوە.</p>
    <div className="translation-progress"><div><span>پێشکەوتن</span><strong>{sourceManifest?.total?Math.round(translatedSourceCount/sourceManifest.total*100):0}%</strong></div><div className="translation-progress-bar"><i style={{width:(sourceManifest?.total?Math.round(translatedSourceCount/sourceManifest.total*100):0)+"%"}} /></div></div>
    <div className="ai-actions"><button onClick={()=>translateNextSourceSummaries(5)} disabled={translationBusy||!sourceManifest}>{translationBusy?"⏳ وەرگێڕان…":"🌐 وەرگێڕانی ٥ پوختە"}</button><button onClick={()=>translateNextSourceSummaries(10)} disabled={translationBusy||!sourceManifest}>🌐 وەرگێڕانی ١٠ پوختە</button>{translationBusy&&<button onClick={()=>{translationStopRef.current=true;setNotice("داواکاری وەرگێڕان دەوەستێت…")}}>⏹ وەستاندن</button>}</div>
    {translationBusy&&<small>{translationProgress.done} / {translationProgress.total} تەواو بوو</small>}
    {!aiConfig.apiKey.trim()&&<small>API Key ـەکەت لە سەرەوە زیاد بکە. وەرگێڕانەکان لە IndexedDB ـی ئامێرەکەت هەڵدەگیرێن.</small>}
  </div>
  <div className="settings-section ai-settings">
  <strong>🤖 یاریدەدەری AI و API Key</strong>
  <p>کلیلی خۆت تێبکە بۆ وەرگێڕان، پوختەکردنەوە و کارکردنی AI. کلیلی API لە GitHub یان کۆدی بەرنامەکەدا دانانرێت.</p>
  <label>خزمەتگوزاری
    <select value={aiConfig.provider} onChange={e=>{const provider=e.target.value as AIProvider;setAiConfig(x=>({...x,provider,model:AI_PROVIDERS[provider].defaultModel}))}}>
      {Object.entries(AI_PROVIDERS).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}
    </select>
  </label>
  <label>API Key
    <div className="api-key-row"><input type={aiKeyVisible?"text":"password"} autoComplete="off" value={aiConfig.apiKey} onChange={e=>setAiConfig(x=>({...x,apiKey:e.target.value}))} placeholder="API Key ـەکەت لێرە دابنێ"/><button type="button" onClick={()=>setAiKeyVisible(v=>!v)}>{aiKeyVisible?"شاردنەوە":"پیشاندان"}</button></div>
  </label>
  <label>Model<input value={aiConfig.model} onChange={e=>setAiConfig(x=>({...x,model:e.target.value}))} placeholder={AI_PROVIDERS[aiConfig.provider].defaultModel}/></label>
  {aiConfig.provider==="custom"&&<label>API Base URL<input value={aiConfig.baseUrl} onChange={e=>setAiConfig(x=>({...x,baseUrl:e.target.value}))} placeholder="https://example.com/v1"/></label>}
  <div className="ai-actions"><button onClick={saveAndTestAI} disabled={aiBusy}>🧪 تاقیکردنەوەی API</button>{selected&&<button onClick={()=>runAI("ئەم کتێبە بە پشتبەستن بە ئەم زانیارییە پوختەیەکی ڕوون و بەسوود بە سۆرانی بنووسە. ناوی کتێب: "+selected.title+"؛ نووسەر: "+selected.author+"؛ پوختەی هەنووکە: "+(selected.summaryKu||selected.summary||"نییە"))} disabled={aiBusy}>✨ پوختەی کتێب</button>}</div>
  {aiBusy&&<div className="ai-status">AI خەریکی کارکردنە…</div>}
  {aiResult&&<div className="ai-result" dir="rtl">{aiResult}</div>}
</div></div></div></div>}
    </main>{notice&&<div className="toast">{notice}</div>}</div>
}


async function extractPdfText(blob:Blob,id:string,setText:React.Dispatch<React.SetStateAction<Record<string,string>>>,notice:(s:string)=>void){
  try{
    const cached=await getExtractedText(id);
    if(cached){ setText(prev=>({...prev,[id]:cached})); return; }
    const pdf=await pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;
    const chunks:string[]=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);
      const content=await page.getTextContent();
      chunks.push(content.items.map((x:any)=>x.str||"").join(" "));
    }
    setText(prev=>({...prev,[id]:chunks.join("\n\n")}));
    await saveExtractedText(id,chunks.join("\n\n"));
    notice("دەقی PDF بۆ گەڕان ئامادە کرا ✓");
    await pdf.destroy();
  }catch{
    notice("PDF دەقی نەهێنراوە؛ OCR لە قۆناغی دواتردا زیاد دەکرێت");
  }
}

function bookTextFor(book:Book){ return (window as any).__kurdishLibraryText?.[book.id] || ""; }

function ReaderContent({book,url,fontSize,onProgress,onNotice,ink,split,initialProgress,onPage,jumpPage}:{book:Book;url:string|null;fontSize:number;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4;initialProgress?:number;onPage?:(page:number,total:number)=>void;jumpPage?:number}){
  const ref=useRef<HTMLDivElement>(null);
  if(book.format==="pdf"){
    if(url)return <PdfReader url={url} onProgress={onProgress} onNotice={onNotice} ink={ink} split={split} initialProgress={initialProgress||0} onPage={onPage} jumpPage={jumpPage}/>;
    return <div className="reader-loading"><div className="reader-spinner">⟳</div><strong>کتێبەکە خێرا دەکرێتەوە…</strong><small>یەکەم لاپەڕە ئامادە دەکرێت</small></div>;
  }
  if(book.format==="epub"){
    if(url)return <EpubReader url={url} onProgress={onProgress} onNotice={onNotice}/>;
    return <div className="reader-loading"><div className="reader-spinner">⟳</div><strong>EPUB دەکرێتەوە…</strong></div>;
  }
  const text=bookTextFor(book)||book.summaryKu||book.summary||"ئەم کتێبە بۆ خوێندنەوەی ئۆفلاین ئامادەیە.";
  return <div className="text-reader" ref={ref} style={{fontSize}} onScroll={e=>{const el=e.currentTarget;onProgress(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));}}><h1>{book.title}</h1><p>{text}</p></div>
}

function PdfReader({url,onProgress,onNotice,ink,split,initialProgress,onPage,jumpPage}:{url:string;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4;initialProgress:number;onPage?:(page:number,total:number)=>void;jumpPage?:number}){
  const host=useRef<HTMLDivElement>(null);
  const touch=useRef({x:0,y:0,dist:0,pinchStart:0,zoomStart:1});
  const [pdf,setPdf]=useState<any>(null);
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    let doc:any=null;
    (async()=>{
      try{
        doc=await pdfjsLib.getDocument({url}).promise;
        if(cancelled){await doc.destroy();return;}
        setPdf(doc); setTotal(doc.numPages);
        setPage(Math.max(1,Math.min(doc.numPages,Math.floor(initialProgress*Math.max(0,doc.numPages-1))+1)));
        onNotice("PDF ئامادەیە ✓");
      }catch{onNotice("نەتوانرا PDF بکرێتەوە");}
    })();
    return()=>{cancelled=true;setPdf(null);if(doc)void doc.destroy();};
  },[url]);

  useEffect(()=>{
    if(!pdf||!host.current)return;
    let cancelled=false;
    setLoading(true);
    (async()=>{
      try{
        const p=await pdf.getPage(page);
        const base=1.35*zoom;
        const viewport=p.getViewport({scale:base});
        const canvas=document.createElement("canvas");
        canvas.className="pdf-page";
        canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        const ctx=canvas.getContext("2d");
        if(!ctx)throw new Error("canvas");
        await p.render({canvasContext:ctx,canvas,viewport}).promise;
        if(cancelled)return;
        const root=host.current!;
        root.replaceChildren();
        if(split===1){
          const pageWrap=document.createElement("div");
          pageWrap.className="pdf-page-wrap";
          pageWrap.style.width=`${viewport.width}px`;
          pageWrap.style.height=`${viewport.height}px`;
          pageWrap.appendChild(canvas);
          try{
            const textContent=await p.getTextContent();
            const layer=document.createElement("div");
            layer.className="textLayer";
            layer.style.setProperty("--scale-factor",String(viewport.scale));
            pageWrap.appendChild(layer);
            const textLayer=new TextLayer({textContentSource:textContent,viewport,container:layer});
            await textLayer.render();
          }catch{}
          root.appendChild(pageWrap);
        } else {
          const cols=2, rows=split===2?1:2;
          const partW=Math.floor(canvas.width/cols), partH=Math.floor(canvas.height/rows);
          for(let part=0;part<split;part++){
            const slice=document.createElement("canvas");
            slice.className="pdf-page pdf-slice";
            slice.width=partW; slice.height=partH;
            slice.getContext("2d")!.drawImage(canvas,(part%cols)*partW,Math.floor(part/cols)*partH,partW,partH,0,0,partW,partH);
            root.appendChild(slice);
          }
          canvas.remove();
        }
        setLoading(false);
      }catch{if(!cancelled){setLoading(false);onNotice("نەتوانرا لاپەڕەکە پیشان بدرێت");}}
    })();
    return()=>{cancelled=true;};
  },[pdf,page,split,zoom]);

  useEffect(()=>{onProgress(total>1?(page-1)/(total-1):0);onPage?.(page,total);},[page,total]);
  useEffect(()=>{if(jumpPage&&total)setPage(Math.max(1,Math.min(total,jumpPage)));},[jumpPage,total]);

  function go(next:number){
    setPage(p=>Math.max(1,Math.min(total||1,p+next)));
  }
  function pinchDistance(e:React.TouchEvent){const a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
  function swipe(dx:number,dy:number){
    if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.15) go(dx<0?1:-1);
  }

  return <div className={`document-reader pdf-page-reader ${ink?"ink":""}`}
    onTouchStart={e=>{const a=e.touches[0];if(e.touches.length===2){touch.current.pinchStart=pinchDistance(e);touch.current.zoomStart=zoom;touch.current.dist=1;}else{touch.current={...touch.current,x:a.clientX,y:a.clientY,dist:0}}}}
    onTouchMove={e=>{if(e.touches.length===2){const d=pinchDistance(e);if(touch.current.pinchStart>0){const next=Math.max(.6,Math.min(4,touch.current.zoomStart*(d/touch.current.pinchStart)));setZoom(next);}}}}
    onTouchEnd={e=>{const a=e.changedTouches[0];if(touch.current.dist===0)swipe(a.clientX-touch.current.x,a.clientY-touch.current.y);touch.current.dist=0;touch.current.pinchStart=0}}
    onKeyDown={e=>{if(e.key==="ArrowLeft")go(-1);if(e.key==="ArrowRight")go(1);}}
    tabIndex={0}>
    <div className="pdf-page-toolbar">
      <button onClick={()=>go(-1)} disabled={page<=1}>‹ پێشوو</button>
      <label className="page-jump">لاپەڕە <input inputMode="numeric" min="1" max={total||1} defaultValue={page} key={page} onKeyDown={e=>{if(e.key==="Enter"){const n=Number((e.currentTarget as HTMLInputElement).value);if(n)setPage(Math.max(1,Math.min(total||1,n)));}}}/></label>
      <span>/ {total||"…"}</span>
      <button onClick={()=>go(1)} disabled={!total||page>=total}>دواتر ›</button>
    </div>
        <div ref={host} className="pdf-page-host"/>
    {loading&&<div className="reader-message">لاپەڕەکە بار دەکرێت…</div>}
    <div className="zoom-bar"><button onClick={()=>setZoom(z=>Math.max(.6,z-.15))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(3,z+.15))}>+</button><button onClick={()=>setZoom(1)}>100%</button></div>
    <div className="page-indicator">{page} / {total||"…"}</div>
  </div>
}

function EpubReader({url,onProgress,onNotice}:{url:string;onProgress:(v:number)=>void;onNotice:(s:string)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const renditionRef=useRef<any>(null);
  const [zoom,setZoom]=useState(100);
  const [ready,setReady]=useState(false);
  const [label,setLabel]=useState("1");
  useEffect(()=>{let book:any;let rendition:any;let cancelled=false;(async()=>{try{book=ePub(url);rendition=book.renderTo(host.current!,{width:"100%",height:"100%",flow:"paginated",manager:"default"});renditionRef.current=rendition;rendition.on("relocated",(location:any)=>{const percentage=location?.start?.percentage;if(typeof percentage==="number")onProgress(Math.max(0,Math.min(1,percentage)));setLabel(String(location?.start?.displayed?.page||location?.start?.index||"1"));});await rendition.display();if(cancelled)return;rendition.themes.fontSize(zoom+"%");setReady(true);onNotice("EPUB ئامادەیە ✓");}catch{if(!cancelled)onNotice("نەتوانرا EPUB بکرێتەوە");}})();return()=>{cancelled=true;renditionRef.current=null;rendition?.destroy?.();book?.destroy?.();};},[url]);
  function changeZoom(delta:number){setZoom(z=>{const next=Math.max(70,Math.min(180,z+delta));renditionRef.current?.themes?.fontSize?.(next+"%");return next;});}
  function go(delta:number){if(delta<0)renditionRef.current?.prev?.();else renditionRef.current?.next?.();}
  const touch=useRef({x:0,y:0,pinch:0});
  return <div className="document-reader epub-reader" tabIndex={0} onKeyDown={e=>{if(e.key==="ArrowLeft")go(-1);if(e.key==="ArrowRight")go(1)}} onTouchStart={e=>{const a=e.touches[0];touch.current={x:a.clientX,y:a.clientY,pinch:e.touches.length===2?1:0}}} onTouchEnd={e=>{if(touch.current.pinch)return;const a=e.changedTouches[0],dx=a.clientX-touch.current.x,dy=a.clientY-touch.current.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.15)go(dx<0?1:-1)}}><div className="epub-toolbar"><button onClick={()=>go(-1)} disabled={!ready}>‹ پێشوو</button><span>لاپەڕە {label}</span><button onClick={()=>go(1)} disabled={!ready}>دواتر ›</button><button onClick={()=>changeZoom(-10)} disabled={!ready}>A−</button><strong>{zoom}%</strong><button onClick={()=>changeZoom(10)} disabled={!ready}>A+</button></div><div ref={host} className="epub-host"/></div>
}
function MediaPlayer(){
  const mediaRef=useRef<HTMLVideoElement>(null);
  const [items,setItems]=useState<{url:string;name:string;isVideo:boolean}[]>([]);
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [muted,setMuted]=useState(false);
  const [volume,setVolume]=useState(1);
  const [time,setTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const current=items[index];
  useEffect(()=>{if(current&&playing)mediaRef.current?.play().catch(()=>{});},[index,current,playing]);

  function pick(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[]);
    if(!files.length)return;
    const next=files.map(f=>({url:URL.createObjectURL(f),name:f.name,isVideo:f.type.startsWith("video/")}));
    items.forEach(x=>URL.revokeObjectURL(x.url));
    setItems(next);setIndex(0);setPlaying(false);setTime(0);setDuration(0);
  }
  function seek(delta:number){const el=mediaRef.current;if(el)el.currentTime=Math.max(0,Math.min(el.duration||0,el.currentTime+delta));}
  function togglePlay(){const el=mediaRef.current;if(!el)return;if(el.paused){el.play().catch(()=>{});setPlaying(true);}else{el.pause();setPlaying(false);}}
  function changeSpeed(){const next=speed>=2?0.5:speed+0.5;setSpeed(next);if(mediaRef.current)mediaRef.current.playbackRate=next;}
  function toggleMute(){const el=mediaRef.current;if(!el)return;el.muted=!el.muted;setMuted(el.muted);}
  function changeVolume(v:number){setVolume(v);if(mediaRef.current)mediaRef.current.volume=v;}
  function move(delta:number){if(!items.length)return;setIndex(i=>Math.max(0,Math.min(items.length-1,i+delta)));setTime(0);setPlaying(false);}
  function fullscreen(){mediaRef.current?.requestFullscreen?.();}

  return <section className="media-panel"><h2>🎬 میدیا پلەیەر</h2><p>دەنگ و ڤیدیۆ بە شێوەی ئۆفلاین پەخش بکە.</p>
    <input type="file" accept="audio/*,video/*" multiple onChange={pick}/>
    <div className="media-name">{current?current.name:"هیچ فایلێک هەڵنەبژێردراوە"}</div>
    {current&&<video key={current.url} ref={mediaRef} className={`media-video ${current.isVideo?"":"audio-only"}`} src={current.url} playsInline onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);e.currentTarget.playbackRate=speed;e.currentTarget.volume=volume}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{if(index<items.length-1){setIndex(i=>i+1);setPlaying(true)}else setPlaying(false)}} controls={false}/>}
    <input className="media-progress" type="range" min="0" max={duration||0.1} step="0.1" value={Math.min(time,duration||0.1)} onChange={e=>{const v=Number(e.target.value);setTime(v);if(mediaRef.current)mediaRef.current.currentTime=v}} disabled={!current}/>
    <div className="media-times"><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div>
    <div className="media-actions">
      <button onClick={()=>move(-1)} disabled={!current||index===0}>⏮︎</button><button onClick={()=>seek(-10)} disabled={!current}>−10s</button><button onClick={togglePlay} disabled={!current}>{playing?"⏸︎":"▶︎"}</button><button onClick={()=>seek(10)} disabled={!current}>+10s</button><button onClick={()=>move(1)} disabled={!current||index===items.length-1}>⏭︎</button>
      <button onClick={changeSpeed} disabled={!current}>{speed}×</button><button onClick={toggleMute} disabled={!current}>{muted?"🔇":"🔊"}</button><button onClick={fullscreen} disabled={!current}>⛶</button>
    </div>
    <label className="media-volume">🔉 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>changeVolume(Number(e.target.value))}/></label>
    {items.length>1&&<div className="media-playlist">{items.map((x,i)=><button key={x.url} className={i===index?"active":""} onClick={()=>{setIndex(i);setTime(0);setPlaying(false)}}>{i+1}. {x.name}</button>)}</div>}
  </section>
}

function formatTime(value:number){if(!Number.isFinite(value))return "00:00";const m=Math.floor(value/60),s=Math.floor(value%60);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{
  state:{error:Error|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error("Kurdish Library runtime error",error,info);}
  render(){
    if(this.state.error){
      return <div dir="rtl" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",fontFamily:"system-ui"}}>
        <div style={{maxWidth:"680px",textAlign:"center"}}>
          <div style={{fontSize:"56px"}}>⚠️</div>
          <h1>کتێبخانەی کوردی نەیتوانی پەڕەکە بار بکات</h1>
          <p>هەڵەیەکی ناچاوەڕوانکراو ڕوویدا. دەتوانیت ئەپەکە دووبارە بار بکەیتەوە.</p>
          <button onClick={()=>location.reload()} style={{padding:"12px 20px",borderRadius:"12px",cursor:"pointer"}}>🔄 دووبارە بارکردنەوە</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

initGlobalErrorHandler();
applyA11y(loadA11y());
registerServiceWorker();
void loadKurdishFonts();
const root=document.getElementById("root");
if(root) createRoot(root).render(<ErrorBoundary><ThemeProvider><AppErrorBoundary><App/></AppErrorBoundary></ThemeProvider></ErrorBoundary>);