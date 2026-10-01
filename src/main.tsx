import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ePub from "epubjs";
import type { Book, Quote, Summary, Author, Highlight } from "./types";
import { getBookFile, getBookState, getBooks, getSummaries, getQuotes, getAuthors, saveBook, saveBookState, saveProgress, saveSummaries, saveQuotes, saveAuthors, getExtractedText, saveExtractedText, getHighlights, saveHighlight, deleteHighlight } from "./storage";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const seed: Book[] = [
  { id:"demo-1", title:"نموونەی کتێبی یەکەم", author:"کتێبخانەی کوردی", category:"ئەدەب", language:"کوردی", format:"txt", summary:"ئەمە کتێبێکی نموونەییە بۆ تاقیکردنەوەی خوێندنەوە.", addedAt:Date.now(), source:"bundle" },
  { id:"demo-2", title:"زانست و ژیان", author:"کتێبخانەی کوردی", category:"زانست", language:"کوردی", format:"txt", summary:"بابەتێکی نموونەیی لەسەر زانست و ژیان.", addedAt:Date.now()-1, source:"bundle" },
  { id:"demo-3", title:"مێژووی کورد", author:"کتێبخانەی کوردی", category:"مێژوو", language:"کوردی", format:"txt", summary:"نموونەیەک بۆ پۆلێنکردن و گەڕان.", addedAt:Date.now()-2, source:"bundle" }
];

function App(){
  const [books,setBooks]=useState<Book[]>(seed);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("هەموو");
  const [theme,setTheme]=useState<"light"|"dark"|"sepia">("light");
  const [selected,setSelected]=useState<Book|null>(null);
  const [states,setStates]=useState<Record<string,Awaited<ReturnType<typeof getBookState>>>>({});
  const [notice,setNotice]=useState("");
  const [fontSize,setFontSize]=useState(19);
  const [fileUrl,setFileUrl]=useState<string|null>(null);
  const [readerMode,setReaderMode]=useState<"normal"|"ink">("normal");
  const [split,setSplit]=useState<1|2|4>(1);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [font,setFont]=useState("system");
  const [compact,setCompact]=useState(false);
  const [tab,setTab]=useState<"home"|"library"|"summaries"|"quotes"|"favorites"|"media">("home");
  const [viewMode,setViewMode]=useState<"grid"|"shelf"|"list"|"small">("grid");
  const [notebookOpen,setNotebookOpen]=useState(false);
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
  

  useEffect(()=>{ getBooks().then(saved=>{ if(saved.length) setBooks(saved); }); getSummaries().then(setSummaries); getQuotes().then(setQuotes); getAuthors().then(setAuthors); },[]);
  useEffect(()=>{ books.forEach(b=>{ if(!extractedText[b.id]) getExtractedText(b.id).then(t=>{if(t)setExtractedText(x=>({...x,[b.id]:t}))}); }); },[books]);
  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),2200); return()=>clearTimeout(t); },[notice]);

  const categories=useMemo(()=>["هەموو",...Array.from(new Set(books.map(b=>b.category).filter(Boolean)))],[books]);
  const favoriteBooks=useMemo(()=>books.filter(b=>states[b.id]?.favorite),[books,states]);
  const recentBooks=useMemo(()=>[...books].sort((a,b)=>(states[b.id]?.lastReadAt||0)-(states[a.id]?.lastReadAt||0)).slice(0,12),[books,states]);
  const visibleBooks=tab==="favorites"?favoriteBooks:books;
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return visibleBooks.filter(b=>(category==="هەموو"||b.category===category)&&(!q||[b.title,b.author,b.category,b.summary,b.summaryKu,b.tags?.join(" "),extractedText[b.id]].filter(Boolean).join(" ").toLocaleLowerCase().includes(q)));
  },[visibleBooks,query,category]);

  async function openBook(book:Book){
    setSelected(book);
    setDetailsOpen(true);
    setFileUrl(null);
    const s=await getBookState(book.id);
    setStates(x=>({...x,[book.id]:s}));
    if(book.source==="import"){
      const blob=await getBookFile(book.id);
      if(blob) { setFileUrl(URL.createObjectURL(blob)); if(book.format==="pdf"){ extractPdfText(blob,book.id,setExtractedText,setNotice); } if(book.format==="txt"||book.format==="html"){ const text=await blob.text(); (window as any).__kurdishLibraryText={...(window as any).__kurdishLibraryText,[book.id]:text.replace(/<[^>]+>/g," ")}; } }
    }
  }
  function closeReader(){ if(fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(null); setSelected(null); }
  async function toggle(key:"favorite"|"bookmark"){
    if(!selected)return;
    const current=states[selected.id] ?? await getBookState(selected.id);
    const next=!current[key];
    await saveBookState(selected.id,{[key]:next});
    setStates(x=>({...x,[selected.id]:{...current,[key]:next}}));
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
    const text=window.getSelection()?.toString().trim() || prompt("دەقی highlight بنووسە")?.trim();
    if(!text) return;
    const item:Highlight={id:`hl-${Date.now()}`,bookId:selected.id,text,color:"yellow",createdAt:Date.now()};
    await saveHighlight(item); setHighlights(x=>[item,...x]); window.getSelection()?.removeAllRanges(); setNotice("Highlight پاشەکەوت کرا ✓");
  }
  async function removeHighlight(id:string){await deleteHighlight(id);setHighlights(x=>x.filter(h=>h.id!==id));}
  async function runOcr(){
    if(!selected || selected.format!=="pdf") return;
    const blob=await getBookFile(selected.id); if(!blob){setNotice("فایلی بۆ OCR نییە");return;}
    setOcrBusy(true); setNotice("OCR دەستی پێکردووە…");
    try{
      const { createWorker }=await import("tesseract.js");
      const worker=await createWorker("ara");
      const pdf=await pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;
      const pages:string[]=[];
      const limit=Math.min(pdf.numPages,30);
      for(let n=1;n<=limit;n++){
        const page=await pdf.getPage(n); const viewport=page.getViewport({scale:1.5});
        const canvas=document.createElement("canvas"); canvas.width=viewport.width; canvas.height=viewport.height;
        await page.render({canvasContext:canvas.getContext("2d")!,viewport}).promise;
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
  }
  return <div className={"app "+theme+" font-"+font+(compact?" compact":"")} lang="ckb" dir="rtl">
    <header><div className="brand-area"><div className="brand">📚</div><div><h1>کتێبخانەی کوردی</h1><p>خوێندنەوەی سۆرانی — ئۆفلاین</p></div></div>
      <div className="top-actions"><label className="import">➕ هاوردەکردن<input hidden type="file" multiple accept=".pdf,.epub,.txt,.html,.htm" onChange={importFiles}/></label>
      <button onClick={()=>setSettingsOpen(true)}>⚙️</button><button onClick={()=>setTheme(theme==="light"?"dark":theme==="dark"?"sepia":"light")}>{theme==="light"?"☀️":theme==="dark"?"🌙":"📜"}</button></div></header>
    <main>      <nav className="main-nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}>🏠 سەرەتا</button><button className={tab==="library"?"active":""} onClick={()=>setTab("library")}>📚 کتێبخانە</button><button className={tab==="summaries"?"active":""} onClick={()=>setTab("summaries")}>✨ پوختەکان</button><button className={tab==="quotes"?"active":""} onClick={()=>setTab("quotes")}>💬 وتەکان</button><button className={tab==="favorites"?"active":""} onClick={()=>setTab("favorites")}>❤️ دڵخوازەکان</button><button className={tab==="media"?"active":""} onClick={()=>setTab("media")}>🎬 میدیا پلەیەر</button><button onClick={()=>setNotebookOpen(true)}>🗒️ تۆمار و تێبینی</button></nav>
<section className="hero"><div><div className="eyebrow">KURDISH LIBRARY • OFFLINE</div><h2>هەموو کتێبەکانت لە یەک شوێن</h2><p>گەڕان، خوێندنەوە، پاشەکەوتکردن و خوێندنەوەی PDF/EPUB بە شێوەی ئۆفلاین.</p></div><div className="stats"><strong>{books.length}</strong><span>کتێب</span><strong>{filtered.length}</strong><span>ئەنجام</span></div><input className="search" placeholder="گەڕان بە ناوی کتێب، نووسەر یان ناوەڕۆک..." value={query} onChange={e=>setQuery(e.target.value)}/></section>
      <nav className="chips">{categories.map(x=><button className={category===x?"active":""} onClick={()=>setCategory(x)} key={x}>{x}</button>)}</nav>
      <section className="home-tools"><button onClick={()=>setSettingsOpen(true)}>⚙️ ڕێکخستنەکان</button><span className="view-label">پیشاندان:</span>{(["grid","shelf","list","small"] as const).map(v=><button key={v} className={viewMode===v?"active-tool":""} onClick={()=>setViewMode(v)}>{v==="grid"?"▦ گرید":v==="shelf"?"▤ ڕەف":v==="list"?"☰ لیست":"▪ ئایکۆنی بچوک"}</button>)}<button onClick={()=>setNotice("بەشی پوختە و وتەکان بۆ داتای ئۆفلاین ئامادە کراوە")}>✨ پوختە و وتەکان</button><button onClick={()=>setNotice("Ink Reader: بۆ PDF لە خوێندنەوەدا چالاکی بکە")}>🖋️ Ink Reader</button></section>      {tab==="summaries"&&<section className="content-panel"><h2>✨ پوختەکانی کتێب</h2>{summaries.length?<div className="content-list">{summaries.map(s=><article key={s.id}><h3>{s.title}</h3><p>{s.textKu}</p></article>)}</div>:<p>هێشتا پوختەی ئۆفلاین زیاد نەکراوە. سیستەمی داتا ئامادەیە بۆ زیادکردنی هەزاران پوختە.</p>}</section>}
      {tab==="quotes"&&<section className="content-panel"><h2>💬 وتەکان</h2>{quotes.length?<div className="quote-list">{quotes.map(q=><article key={q.id}><blockquote>“{q.textKu}”</blockquote><strong>{q.author}</strong></article>)}</div>:<p>هێشتا وتەی ئۆفلاین زیاد نەکراوە. سیستەمی داتا ئامادەیە بۆ کۆمەڵەی زۆرتر.</p>}</section>}
      {tab==="media"&&<MediaPlayer/>}
      {tab!=="media"&&<section className="notebook-launch"><button onClick={()=>setNotebookOpen(true)}>🗒️ تۆمار و تێبینییەکان</button><span>{Object.values(states).filter(s=>s.note).length} تێبینی</span></section>}{tab!=="summaries"&&tab!=="quotes"&&tab!=="media"&&<section className={`grid view-${viewMode}`}>{filtered.map(b=><article className="card" key={b.id} onClick={()=>openBook(b)}><div className="cover">{b.format==="pdf"?"📕":b.format==="epub"?"📘":"📖"}</div><div className="card-body"><small>{b.category} · {b.format.toUpperCase()}</small><h3>{b.title}</h3><p>{b.author}</p><span>{b.summaryKu||b.summary||"کلیک بکە بۆ خوێندنەوە."}</span></div></article>)}</section>}

      {selected&&detailsOpen&&<div className="modal" onClick={()=>setDetailsOpen(false)}><div className="book-details" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author}</small></div><button onClick={()=>setDetailsOpen(false)}>✕</button></div><div className="book-details-grid"><div className="detail-cover">{selected.coverPath?<img src={selected.coverPath} alt="" />:<div>{selected.format==="pdf"?"📕":selected.format==="epub"?"📘":"📖"}</div>}</div><div><h2>{selected.title}</h2><p className="author-line">✍️ {selected.author}</p><p>📂 {selected.category} · {selected.language}</p><p>📄 {selected.format.toUpperCase()}</p>{selected.sizeBytes&&<p>💾 {(selected.sizeBytes/1024/1024).toFixed(1)} MB</p>}<div className="progress-line"><span style={{width:`${Math.round((states[selected.id]?.progress||0)*100)}%`}} /></div><small>{Math.round((states[selected.id]?.progress||0)*100)}% خوێندراوەتەوە</small></div></div>{(selected.summaryKu||selected.summary)&&<section className="detail-summary"><h3>✨ پوختە</h3><p>{selected.summaryKu||selected.summary}</p></section>}{summaries.filter(s=>s.bookId===selected.id).slice(0,1).map(s=><section className="detail-summary" key={s.id}><h3>✨ پوختەی ئۆفلاین</h3><p>{s.textKu}</p></section>)}<div className="detail-quotes">{quotes.filter(q=>q.author===selected.author||q.authorId===selected.author).slice(0,3).map(q=><blockquote key={q.id}>“{q.textKu}”<small>— {q.author}</small></blockquote>)}</div><div className="detail-actions"><button onClick={()=>{setDetailsOpen(false)}}>📖 خوێندنەوە</button><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️ دڵخوازە":"🤍 زیادکردن بۆ دڵخواز"}</button><button onClick={()=>toggle("bookmark")}>🔖 نیشانە</button></div></div></div>}
      {selected&&!detailsOpen&&<div className="modal" onClick={closeReader}><div className="reader" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author} · {selected.format.toUpperCase()}</small></div><button onClick={closeReader}>✕</button></div>
      <ReaderContent book={selected} url={fileUrl} fontSize={fontSize} onProgress={v=>saveProgress(selected.id,v)} onNotice={setNotice} ink={readerMode==="ink"} split={split} initialProgress={states[selected.id]?.progress||0}/>
      <div className="reader-tools"><button className={readerMode==="ink"?"active-tool":""} onClick={()=>setReaderMode(readerMode==="ink"?"normal":"ink")}>🖋️ Ink</button><span>Split:</span>{([1,2,4] as const).map(n=><button key={n} className={split===n?"active-tool":""} onClick={()=>setSplit(n)}>{n}×</button>)}</div><div className="reader-foot"><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️":"🤍"} دڵخواز</button><button onClick={()=>toggle("bookmark")}>{states[selected.id]?.bookmark?"🔖":"📑"} نیشانە</button><button onClick={note}>📝 تێبینی</button><button onClick={speak}>🔊 خوێندنەوە</button><button onClick={addHighlight}>🖍️ Highlight</button>{selected.format==="pdf"&&<button onClick={runOcr} disabled={ocrBusy}>🔎 {ocrBusy?"OCR…":"OCR"}</button>}<button onClick={()=>setFontSize(v=>Math.min(30,v+2))}>A+</button><button onClick={()=>setFontSize(v=>Math.max(14,v-2))}>A−</button></div>
      </div></div>}
      {notebookOpen&&<div className="modal" onClick={()=>setNotebookOpen(false)}><div className="notebook" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>🗒️ تۆمار و تێبینی</strong><small>تێبینییەکانت بە ئۆفلاین هەڵدەگیرێن</small></div><button onClick={()=>setNotebookOpen(false)}>✕</button></div><div className="notebook-grid"><div><input placeholder="گەڕان لە تێبینییەکان..." value={notebookFilter} onChange={e=>setNotebookFilter(e.target.value)}/><div className="notebook-list">{books.filter(b=>{const n=states[b.id]?.note||"";return n&&(!notebookFilter||`${b.title} ${n}`.toLocaleLowerCase().includes(notebookFilter.toLocaleLowerCase()))}).map(b=><article key={b.id}><strong>{b.title}</strong><small>{b.author}</small><p>{states[b.id]?.note}</p><button onClick={()=>{setSelected(b);setDetailsOpen(false);setNotebookOpen(false);}}>📖 کردنەوە</button></article>)}{!books.some(b=>states[b.id]?.note)&&<p>هێشتا تێبینییەکت نییە.</p>}</div></div><div className="notebook-editor"><input placeholder="ناونیشانی تۆمار" value={noteTitle} onChange={e=>setNoteTitle(e.target.value)}/><textarea placeholder="تێبینییەک بنووسە..." value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} rows={12}/><button onClick={async()=>{if(!selected||!noteDraft.trim())return;await saveBookState(selected.id,{note:noteDraft});setStates(x=>({...x,[selected.id]:{...(x[selected.id]||{favorite:false,bookmark:false,note:"",progress:0}),note:noteDraft}}));setNotice("تۆمار پاشەکەوت کرا ✓");}}>💾 پاشەکەوتکردن</button></div></div></div></div>}
      {settingsOpen&&<div className="modal" onClick={()=>setSettingsOpen(false)}><div className="settings" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>⚙️ ڕێکخستنەکان</strong><small>ڕێکخستنی خوێندنەوە و شێوازی دەرکەوتن</small></div><button onClick={()=>setSettingsOpen(false)}>✕</button></div><div className="settings-grid"><label>شێوازی ڕووکار<select value={theme} onChange={e=>setTheme(e.target.value as "light"|"dark"|"sepia")}><option value="light">☀️ ڕووناک</option><option value="dark">🌙 تاریک</option><option value="sepia">📜 سێپیا</option></select></label><label>جۆری فۆنت<select value={font} onChange={e=>setFont(e.target.value)}><option value="system">سیستەم</option><option value="serif">Serif</option><option value="sans">Sans</option></select></label><label>قەبارەی نووسین: {fontSize}px<input type="range" min="14" max="30" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label><label><span>لیستی کورتتر</span><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label><div className="settings-section"><strong>📚 ئۆفلاین</strong><p>کتێبە هاوردەکراوەکان و پێشکەوتنی خوێندنەوە لە ناوخۆی ئامێرەکەت هەڵدەگیرێن.</p></div><div className="settings-section"><strong>🖋️ Ink Reader</strong><p>شێوازی grayscale بۆ خوێندنەوەی سادە و Split ـی 2× و 4× بۆ دابەشکردنی لاپەڕەی PDF بەکار دێت.</p></div></div></div></div>}
    </main>{notice&&<div className="toast">{notice}</div>}</div>
}


async function extractPdfText(blob:Blob,id:string,setText:React.Dispatch<React.SetStateAction<Record<string,string>>>,notice:(s:string)=>void){
  try{
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

function ReaderContent({book,url,fontSize,onProgress,onNotice,ink,split,initialProgress}:{book:Book;url:string|null;fontSize:number;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4;initialProgress?:number}){
  const ref=useRef<HTMLDivElement>(null);
  if(book.format==="pdf"&&url)return <PdfReader url={url} onProgress={onProgress} onNotice={onNotice} ink={ink} split={split} initialProgress={initialProgress||0}/>;
  if(book.format==="epub"&&url)return <EpubReader url={url} onProgress={onProgress} onNotice={onNotice}/>;
  const text=bookTextFor(book)||book.summaryKu||book.summary||"ئەم کتێبە بۆ خوێندنەوەی ئۆفلاین ئامادەیە.";
  return <div className="text-reader" ref={ref} style={{fontSize}} onScroll={e=>{const el=e.currentTarget;onProgress(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));}}><h1>{book.title}</h1><p>{text}</p></div>
}

function PdfReader({url,onProgress,onNotice,ink,split,initialProgress}:{url:string;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4;initialProgress:number}){
  const host=useRef<HTMLDivElement>(null);
  const touch=useRef({x:0,y:0,dist:0});
  const [pdf,setPdf]=useState<any>(null);
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const doc=await pdfjsLib.getDocument(url).promise;
        if(cancelled){doc.destroy();return;}
        setPdf(doc); setTotal(doc.numPages);
        setPage(Math.max(1,Math.min(doc.numPages,Math.floor(initialProgress*Math.max(0,doc.numPages-1))+1)));
        onNotice("PDF ئامادەیە ✓");
      }catch{onNotice("نەتوانرا PDF بکرێتەوە");}
    })();
    return()=>{cancelled=true;setPdf(null);};
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
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        const ctx=canvas.getContext("2d");
        if(!ctx)throw new Error("canvas");
        await p.render({canvasContext:ctx,viewport}).promise;
        if(cancelled)return;
        const root=host.current!;
        root.replaceChildren();
        if(split===1){root.appendChild(canvas);}
        else{
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

  useEffect(()=>{onProgress(total>1?(page-1)/(total-1):0);},[page,total]);

  function go(next:number){
    setPage(p=>Math.max(1,Math.min(total||1,p+next)));
  }
  function swipe(dx:number,dy:number){
    if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.15) go(dx<0?1:-1);
  }

  return <div className={`document-reader pdf-page-reader ${ink?"ink":""}`}
    onTouchStart={e=>{const a=e.touches[0];touch.current={x:a.clientX,y:a.clientY,dist:e.touches.length===2?1:0}}}
    onTouchMove={e=>{if(e.touches.length===2)touch.current.dist=1}}
    onTouchEnd={e=>{const a=e.changedTouches[0];if(touch.current.dist===0)swipe(a.clientX-touch.current.x,a.clientY-touch.current.y);touch.current.dist=0}}
    onKeyDown={e=>{if(e.key==="ArrowLeft")go(-1);if(e.key==="ArrowRight")go(1);}}
    tabIndex={0}>
    <div className="pdf-page-toolbar">
      <button onClick={()=>go(-1)} disabled={page<=1}>‹ پێشوو</button>
      <span>{page} / {total||"…"}</span>
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
  useEffect(()=>{let book:any;let rendition:any; (async()=>{try{book=ePub(url);rendition=book.renderTo(host.current!,{width:"100%",height:"100%",flow:"scrolled-doc",manager:"continuous"});await rendition.display();onNotice("EPUB ئامادەیە ✓");}catch{onNotice("نەتوانرا EPUB بکرێتەوە");}})();return()=>{rendition?.destroy?.();book?.destroy?.();};},[url]);
  return <div className="document-reader epub-reader" onScroll={e=>{const el=e.currentTarget;onProgress(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));}}><div ref={host} className="epub-host"/></div>
}

function MediaPlayer(){
  const mediaRef=useRef<HTMLVideoElement>(null);
  const [src,setSrc]=useState<string|null>(null);
  const [name,setName]=useState("");
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [muted,setMuted]=useState(false);
  const [time,setTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const [isVideo,setIsVideo]=useState(true);

  function pick(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(!f)return;
    if(src)URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(f)); setName(f.name); setIsVideo(f.type.startsWith("video/")); setPlaying(false); setTime(0); setDuration(0);
  }
  function seek(delta:number){const el=mediaRef.current;if(el)el.currentTime=Math.max(0,Math.min(el.duration||0,el.currentTime+delta));}
  function togglePlay(){const el=mediaRef.current;if(!el)return;if(el.paused){el.play();setPlaying(true);}else{el.pause();setPlaying(false);}}
  function changeSpeed(){const next=speed>=2?0.5:speed+0.5;setSpeed(next);if(mediaRef.current)mediaRef.current.playbackRate=next;}
  function toggleMute(){const el=mediaRef.current;if(!el)return;el.muted=!el.muted;setMuted(el.muted);}
  function fullscreen(){mediaRef.current?.requestFullscreen?.();}

  return <section className="media-panel"><h2>🎬 میدیا پلەیەر</h2><p>فایلەکانی دەنگ و ڤیدیۆ لە ناوخۆی ئامێرەکەت بە شێوەی ئۆفلاین پەخش بکە.</p>
    <input type="file" accept="audio/*,video/*" onChange={pick}/>
    <div className="media-name">{name||"هیچ فایلێک هەڵنەبژێردراوە"}</div>
    {src&&<video ref={mediaRef} className={`media-video ${isVideo?"":"audio-only"}`} src={src} playsInline onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} controls={false}/>}
    <input className="media-progress" type="range" min="0" max={duration||0.1} step="0.1" value={Math.min(time,duration||0.1)} onChange={e=>{const v=Number(e.target.value);setTime(v);if(mediaRef.current)mediaRef.current.currentTime=v}} disabled={!src}/>
    <div className="media-times"><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div>
    <div className="media-actions">
      <button onClick={()=>seek(-10)} disabled={!src}>⏮︎ 10s</button><button onClick={togglePlay} disabled={!src}>{playing?"⏸︎":"▶︎"}</button><button onClick={()=>seek(10)} disabled={!src}>10s ⏭︎</button>
      <button onClick={changeSpeed} disabled={!src}>{speed}×</button><button onClick={toggleMute} disabled={!src}>{muted?"🔇":"🔊"}</button><button onClick={fullscreen} disabled={!src}>⛶</button>
    </div>
    <small>پشتیوانییە سەرەتایییەکان: play/pause، پاش/پێش ١٠ چرکە، خێرایی، mute، seek و fullscreen.</small>
  </section>
}
function formatTime(value:number){if(!Number.isFinite(value))return "00:00";const m=Math.floor(value/60),s=Math.floor(value%60);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
createRoot(document.getElementById("root")!).render(<App/>);
function MediaPlayer(){return <section className="media-panel"><h2>🎬 میدیا پلەیەر</h2><p>پلەیەری ناوخۆیی بۆ فایلەکانی دەنگ و ڤیدیۆ، بە پشتگیری offline.</p><input type="file" accept="audio/*,video/*" onChange={e=>{const f=e.target.files?.[0];const el=document.getElementById("media-element") as HTMLMediaElement|null;if(f&&el){el.src=URL.createObjectURL(f);el.load();}}}/><video id="media-element" className="media-video" controls playsInline/><div className="media-actions"><button>⏮︎ 10s</button><button>▶︎ / ⏸</button><button>⏭︎ 10s</button><button>1×</button><button>🔊 دەنگ</button><button>⛶ پڕ شاشە</button></div><small>بنەمای پلەیەرەکە بۆ زیادکردنی playback speed، subtitles، audio tracks و gesture controls ئامادە کراوە.</small></section>}
