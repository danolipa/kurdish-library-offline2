import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ePub from "epubjs";
import type { Book, Quote, Summary, Author } from "./types";
import { getBookFile, getBookState, getBooks, getSummaries, getQuotes, getAuthors, saveBook, saveBookState, saveProgress, saveSummaries, saveQuotes, saveAuthors } from "./storage";
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
  const [tab,setTab]=useState<"home"|"library"|"summaries"|"quotes"|"favorites">("home");
  const [summaries,setSummaries]=useState<Summary[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [authors,setAuthors]=useState<Author[]>([]);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [bookText,setBookText]=useState<Record<string,string>>({});

  useEffect(()=>{ getBooks().then(saved=>{ if(saved.length) setBooks(saved); }); getSummaries().then(setSummaries); getQuotes().then(setQuotes); getAuthors().then(setAuthors); },[]);
  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),2200); return()=>clearTimeout(t); },[notice]);

  const categories=useMemo(()=>["هەموو",...Array.from(new Set(books.map(b=>b.category).filter(Boolean)))],[books]);
  const favoriteBooks=useMemo(()=>books.filter(b=>states[b.id]?.favorite),[books,states]);
  const visibleBooks=tab==="favorites"?favoriteBooks:books;
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return visibleBooks.filter(b=>(category==="هەموو"||b.category===category)&&(!q||[b.title,b.author,b.category,b.summary,b.summaryKu,b.tags?.join(" ")].filter(Boolean).join(" ").toLocaleLowerCase().includes(q)));
  },[visibleBooks,query,category]);

  async function openBook(book:Book){
    setSelected(book);
    setDetailsOpen(true);
    setFileUrl(null);
    const s=await getBookState(book.id);
    setStates(x=>({...x,[book.id]:s}));
    if(book.source==="import"){
      const blob=await getBookFile(book.id);
      if(blob) { setFileUrl(URL.createObjectURL(blob)); if(book.format==="txt"||book.format==="html"){ const text=await blob.text(); setBookText(x=>({...x,[book.id]:text.replace(/<[^>]+>/g," ")})); (window as any).__kurdishLibraryText={...(window as any).__kurdishLibraryText,[book.id]:text.replace(/<[^>]+>/g," ")}; } }
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
    <main>      <nav className="main-nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}>🏠 سەرەتا</button><button className={tab==="library"?"active":""} onClick={()=>setTab("library")}>📚 کتێبخانە</button><button className={tab==="summaries"?"active":""} onClick={()=>setTab("summaries")}>✨ پوختەکان</button><button className={tab==="quotes"?"active":""} onClick={()=>setTab("quotes")}>💬 وتەکان</button><button className={tab==="favorites"?"active":""} onClick={()=>setTab("favorites")}>❤️ دڵخوازەکان</button></nav>
<section className="hero"><div><div className="eyebrow">KURDISH LIBRARY • OFFLINE</div><h2>هەموو کتێبەکانت لە یەک شوێن</h2><p>گەڕان، خوێندنەوە، پاشەکەوتکردن و خوێندنەوەی PDF/EPUB بە شێوەی ئۆفلاین.</p></div><div className="stats"><strong>{books.length}</strong><span>کتێب</span><strong>{filtered.length}</strong><span>ئەنجام</span></div><input className="search" placeholder="گەڕان بە ناوی کتێب، نووسەر یان ناوەڕۆک..." value={query} onChange={e=>setQuery(e.target.value)}/></section>
      <nav className="chips">{categories.map(x=><button className={category===x?"active":""} onClick={()=>setCategory(x)} key={x}>{x}</button>)}</nav>
      <section className="home-tools"><button onClick={()=>setSettingsOpen(true)}>⚙️ ڕێکخستنەکان</button><button onClick={()=>setNotice("بەشی پوختە و وتەکان بۆ داتای ئۆفلاین ئامادە کراوە")}>✨ پوختە و وتەکان</button><button onClick={()=>setNotice("Ink Reader: بۆ PDF لە خوێندنەوەدا چالاکی بکە")}>🖋️ Ink Reader</button></section>      {tab==="summaries"&&<section className="content-panel"><h2>✨ پوختەکانی کتێب</h2>{summaries.length?<div className="content-list">{summaries.map(s=><article key={s.id}><h3>{s.title}</h3><p>{s.textKu}</p></article>)}</div>:<p>هێشتا پوختەی ئۆفلاین زیاد نەکراوە. سیستەمی داتا ئامادەیە بۆ زیادکردنی هەزاران پوختە.</p>}</section>}
      {tab==="quotes"&&<section className="content-panel"><h2>💬 وتەکان</h2>{quotes.length?<div className="quote-list">{quotes.map(q=><article key={q.id}><blockquote>“{q.textKu}”</blockquote><strong>{q.author}</strong></article>)}</div>:<p>هێشتا وتەی ئۆفلاین زیاد نەکراوە. سیستەمی داتا ئامادەیە بۆ کۆمەڵەی زۆرتر.</p>}</section>}
      {tab!=="summaries"&&tab!=="quotes"&&<section className="grid">{filtered.map(b=><article className="card" key={b.id} onClick={()=>openBook(b)}><div className="cover">{b.format==="pdf"?"📕":b.format==="epub"?"📘":"📖"}</div><div className="card-body"><small>{b.category} · {b.format.toUpperCase()}</small><h3>{b.title}</h3><p>{b.author}</p><span>{b.summaryKu||b.summary||"کلیک بکە بۆ خوێندنەوە."}</span></div></article>)}</section>}

      {selected&&detailsOpen&&<div className="modal" onClick={()=>setDetailsOpen(false)}><div className="book-details" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author}</small></div><button onClick={()=>setDetailsOpen(false)}>✕</button></div><div className="book-details-grid"><div className="detail-cover">{selected.coverPath?<img src={selected.coverPath} alt="" />:<div>{selected.format==="pdf"?"📕":selected.format==="epub"?"📘":"📖"}</div>}</div><div><h2>{selected.title}</h2><p className="author-line">✍️ {selected.author}</p><p>📂 {selected.category} · {selected.language}</p><p>📄 {selected.format.toUpperCase()}</p>{selected.sizeBytes&&<p>💾 {(selected.sizeBytes/1024/1024).toFixed(1)} MB</p>}<div className="progress-line"><span style={{width:`${Math.round((states[selected.id]?.progress||0)*100)}%`}} /></div><small>{Math.round((states[selected.id]?.progress||0)*100)}% خوێندراوەتەوە</small></div></div>{(selected.summaryKu||selected.summary)&&<section className="detail-summary"><h3>✨ پوختە</h3><p>{selected.summaryKu||selected.summary}</p></section>}{summaries.filter(s=>s.bookId===selected.id).slice(0,1).map(s=><section className="detail-summary" key={s.id}><h3>✨ پوختەی ئۆفلاین</h3><p>{s.textKu}</p></section>)}<div className="detail-quotes">{quotes.filter(q=>q.author===selected.author||q.authorId===selected.author).slice(0,3).map(q=><blockquote key={q.id}>“{q.textKu}”<small>— {q.author}</small></blockquote>)}</div><div className="detail-actions"><button onClick={()=>{setDetailsOpen(false)}}>📖 خوێندنەوە</button><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️ دڵخوازە":"🤍 زیادکردن بۆ دڵخواز"}</button><button onClick={()=>toggle("bookmark")}>🔖 نیشانە</button></div></div></div>}
      {selected&&!detailsOpen&&<div className="modal" onClick={closeReader}><div className="reader" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>{selected.title}</strong><small>{selected.author} · {selected.format.toUpperCase()}</small></div><button onClick={closeReader}>✕</button></div>
      <ReaderContent book={selected} url={fileUrl} fontSize={fontSize} onProgress={v=>saveProgress(selected.id,v)} onNotice={setNotice} ink={readerMode==="ink"} split={split}/>
      <div className="reader-tools"><button className={readerMode==="ink"?"active-tool":""} onClick={()=>setReaderMode(readerMode==="ink"?"normal":"ink")}>🖋️ Ink</button><span>Split:</span>{([1,2,4] as const).map(n=><button key={n} className={split===n?"active-tool":""} onClick={()=>setSplit(n)}>{n}×</button>)}</div><div className="reader-foot"><button onClick={()=>toggle("favorite")}>{states[selected.id]?.favorite?"❤️":"🤍"} دڵخواز</button><button onClick={()=>toggle("bookmark")}>{states[selected.id]?.bookmark?"🔖":"📑"} نیشانە</button><button onClick={note}>📝 تێبینی</button><button onClick={speak}>🔊 خوێندنەوە</button><button onClick={()=>setFontSize(v=>Math.min(30,v+2))}>A+</button><button onClick={()=>setFontSize(v=>Math.max(14,v-2))}>A−</button></div>
      </div></div>}
      {settingsOpen&&<div className="modal" onClick={()=>setSettingsOpen(false)}><div className="settings" onClick={e=>e.stopPropagation()}><div className="reader-head"><div><strong>⚙️ ڕێکخستنەکان</strong><small>ڕێکخستنی خوێندنەوە و شێوازی دەرکەوتن</small></div><button onClick={()=>setSettingsOpen(false)}>✕</button></div><div className="settings-grid"><label>شێوازی ڕووکار<select value={theme} onChange={e=>setTheme(e.target.value as "light"|"dark"|"sepia")}><option value="light">☀️ ڕووناک</option><option value="dark">🌙 تاریک</option><option value="sepia">📜 سێپیا</option></select></label><label>جۆری فۆنت<select value={font} onChange={e=>setFont(e.target.value)}><option value="system">سیستەم</option><option value="serif">Serif</option><option value="sans">Sans</option></select></label><label>قەبارەی نووسین: {fontSize}px<input type="range" min="14" max="30" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label><label><span>لیستی کورتتر</span><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label><div className="settings-section"><strong>📚 ئۆفلاین</strong><p>کتێبە هاوردەکراوەکان و پێشکەوتنی خوێندنەوە لە ناوخۆی ئامێرەکەت هەڵدەگیرێن.</p></div><div className="settings-section"><strong>🖋️ Ink Reader</strong><p>شێوازی grayscale بۆ خوێندنەوەی سادە و Split ـی 2× و 4× بۆ دابەشکردنی لاپەڕەی PDF بەکار دێت.</p></div></div></div></div>}
    </main>{notice&&<div className="toast">{notice}</div>}</div>
}

function bookTextFor(book:Book){ return (window as any).__kurdishLibraryText?.[book.id] || ""; }

function ReaderContent({book,url,fontSize,onProgress,onNotice,ink,split}:{book:Book;url:string|null;fontSize:number;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4}){
  const ref=useRef<HTMLDivElement>(null);
  if(book.format==="pdf"&&url)return <PdfReader url={url} onProgress={onProgress} onNotice={onNotice} ink={ink} split={split}/>;
  if(book.format==="epub"&&url)return <EpubReader url={url} onProgress={onProgress} onNotice={onNotice}/>;
  const text=bookTextFor(book)||book.summaryKu||book.summary||"ئەم کتێبە بۆ خوێندنەوەی ئۆفلاین ئامادەیە.";
  return <div className="text-reader" ref={ref} style={{fontSize}} onScroll={e=>{const el=e.currentTarget;onProgress(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));}}><h1>{book.title}</h1><p>{text}</p></div>
}
function PdfReader({url,onProgress,onNotice,ink,split}:{url:string;onProgress:(v:number)=>void;onNotice:(s:string)=>void;ink:boolean;split:1|2|4}){
  const host=useRef<HTMLDivElement>(null);
  const [page,setPage]=useState(1); const [total,setTotal]=useState(0);
  useEffect(()=>{let cancelled=false;let pdf:any; (async()=>{try{pdf=await pdfjsLib.getDocument(url).promise;if(cancelled)return;setTotal(pdf.numPages);const root=host.current;if(!root)return;root.innerHTML="";for(let n=1;n<=pdf.numPages;n++){if(cancelled)break;const p=await pdf.getPage(n);const viewport=p.getViewport({scale:1.35});const canvas=document.createElement("canvas");canvas.className="pdf-page";canvas.width=viewport.width;canvas.height=viewport.height;await p.render({canvasContext:canvas.getContext("2d")!,viewport}).promise; if(split===1){root.appendChild(canvas);} else {const cols=split===2?2:2; const rows=split===2?1:2; const partW=Math.floor(canvas.width/cols); const partH=Math.floor(canvas.height/rows); for(let part=0;part<split;part++){const c=document.createElement("canvas"); c.className="pdf-page pdf-slice"; c.dataset.part=String(part+1); c.width=partW; c.height=partH; const ctx=c.getContext("2d")!; const sx=(part%cols)*partW; const sy=Math.floor(part/cols)*partH; ctx.drawImage(canvas,sx,sy,partW,partH,0,0,partW,partH); root.appendChild(c);} canvas.remove();}}onNotice("PDF ئامادەیە ✓");}catch(e){onNotice("نەتوانرا PDF بکرێتەوە");}})();return()=>{cancelled=true;pdf?.destroy?.();};},[url,split]);
  return <div className={`document-reader split-${split} ${ink ? "ink" : ""}`} onScroll={e=>{const el=e.currentTarget;const v=el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight);onProgress(v);setPage(Math.max(1,Math.min(total,Math.round(v*Math.max(1,total-1))+1)));}}><div ref={host}/><div className="page-indicator">{page} / {total||"…"}</div></div>
}
function EpubReader({url,onProgress,onNotice}:{url:string;onProgress:(v:number)=>void;onNotice:(s:string)=>void}){
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{let book:any;let rendition:any; (async()=>{try{book=ePub(url);rendition=book.renderTo(host.current!,{width:"100%",height:"100%",flow:"scrolled-doc",manager:"continuous"});await rendition.display();onNotice("EPUB ئامادەیە ✓");}catch(e){onNotice("نەتوانرا EPUB بکرێتەوە");}})();return()=>{rendition?.destroy?.();book?.destroy?.();};},[url]);
  return <div className="document-reader epub-reader" onScroll={e=>{const el=e.currentTarget;onProgress(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));}}><div ref={host} className="epub-host"/></div>
}
createRoot(document.getElementById("root")!).render(<App/>);