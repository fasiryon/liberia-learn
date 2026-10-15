"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, ChevronLeft, List, Minus, Plus, Volume2, X } from "lucide-react";
import { readMemory, type BookPage, type ReadingBook, type ReaderMemory } from "./model";
import styles from "./textbooks.module.css";

function FractionExplorer() {
  const [parts, setParts] = useState(4);
  const [selected, setSelected] = useState([0, 1, 2]);
  return <div className={styles.explorer}>
    <div className={styles.explorerLabel}>EXPLORE A FRACTION <span>Try it yourself</span></div>
    <div className={styles.fractionTiles} style={{ gridTemplateColumns: `repeat(${parts}, 1fr)` }}>
      {Array.from({ length: parts }, (_, i) => <button key={i} type="button" aria-label={`Part ${i + 1} of ${parts}`} aria-pressed={selected.includes(i)} className={selected.includes(i) ? styles.selectedTile : ""} onClick={() => setSelected(s => s.includes(i) ? s.filter(n => n !== i) : [...s, i])} />)}
    </div>
    <div className={styles.fractionResult}><span className={styles.fractionNumber}><b>{selected.length}</b><b>{parts}</b></span><p aria-live="polite"><strong>{selected.length} of {parts} equal parts</strong><br />{selected.length === parts ? "You have selected one whole." : "Tap a piece to change your fraction."}</p></div>
    <label className={styles.partsLabel}>Equal parts <select value={parts} onChange={e => { setParts(Number(e.target.value)); setSelected([]); }}>{[2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} parts</option>)}</select></label>
    <p className={styles.smallNote}>Exploration only. No score or completion is recorded.</p>
  </div>;
}

function CitrusIllustration() {
  return <figure className={styles.citrus}><svg viewBox="0 0 460 190" role="img" aria-label="One whole orange and two equal orange halves illustrate sharing a whole equally.">
    <defs><radialGradient id="textbook-orange"><stop stopColor="#f6b34c" /><stop offset="1" stopColor="#dc782d" /></radialGradient></defs>
    <ellipse cx="230" cy="168" rx="180" ry="10" fill="#425b45" opacity=".1" />
    <circle cx="115" cy="100" r="61" fill="url(#textbook-orange)" /><path d="M112 41 Q105 8 149 23 Q142 45 112 41" fill="#55704b" /><path d="M113 42l-2-14" stroke="#516543" strokeWidth="5" />
    {[260, 365].map((cx, i) => <g key={cx} transform={`translate(${cx} 105) rotate(${i ? 16 : -12})`}><path d="M-45 0 A45 45 0 0 0 45 0Z" fill="#df8239" stroke="#fff0d3" strokeWidth="7" /><path d="M-37 4 A37 37 0 0 0 37 4Z" fill="#edab56" />{[-32, -16, 0, 16, 32].map(x => <path key={x} d={`M0 3 L${x} ${Math.sqrt(37 ** 2 - x ** 2)}`} stroke="#fff0d3" strokeWidth="3" />)}</g>)}
    <text x="115" y="186" textAnchor="middle" fontSize="13" fill="#435448">one whole</text><text x="310" y="186" textAnchor="middle" fontSize="13" fill="#435448">two equal halves</text>
  </svg><figcaption>Every whole has a story. Let&apos;s explore its parts.</figcaption></figure>;
}

function PageImage({ image }: { image: NonNullable<BookPage["image"]> }) {
  const [failed, setFailed] = useState(false);
  return failed || !image.src ? <div className={styles.notice}>Illustration unavailable. {image.alt}</div> : <figure className={styles.pageImage}>
    {/* Native img preserves the authored URL and supplies an honest missing-asset fallback. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image.src} alt={image.alt} onError={() => setFailed(true)} /><figcaption>{image.alt}</figcaption>
  </figure>;
}

export function TextbookReader({ book, persistenceScope, backHref = "/student/textbooks", preview = false }: { book: ReadingBook; persistenceScope?: string; backHref?: string; preview?: boolean }) {
  const [memory, setMemory] = useState<ReaderMemory>(() => readMemory(null, book.pages.length));
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(false);
  const [contents, setContents] = useState(false);
  const [tab, setTab] = useState<"chapters" | "bookmarks">("chapters");
  const [offline, setOffline] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [audioNote, setAudioNote] = useState("");
  const [narrationPart, setNarrationPart] = useState(0);
  const preparedAudio = useRef<HTMLAudioElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const toggleContents = useRef<HTMLButtonElement>(null);
  const readerElement = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  // Only synthetic content uses durable browser storage. Real readings keep aids in this tab.
  // No content payload or educational state is saved; the key scopes aids to user and school.
  const key = `ll:textbook:${encodeURIComponent(persistenceScope ?? "demo")}:${encodeURIComponent(book.id)}:${encodeURIComponent(book.version)}`;
  const durable = book.source === "demonstration";
  useEffect(() => {
    try { setMemory(readMemory((durable ? localStorage : sessionStorage).getItem(key), book.pages.length)); }
    catch { setStorageNote("Reading aids are available for this visit only; device storage is unavailable."); }
    setReady(true);
  }, [key, durable, book.pages.length]);
  useEffect(() => {
    if (!ready) return;
    try { (durable ? localStorage : sessionStorage).setItem(key, JSON.stringify(memory)); }
    catch { setStorageNote("Your reading position could not be saved. You can keep reading."); }
  }, [ready, key, durable, memory]);
  useEffect(() => {
    const resize = () => setWide((readerElement.current?.getBoundingClientRect().width ?? innerWidth) >= 1100);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    const connection = () => setOffline(!navigator.onLine);
    resize(); connection(); if (readerElement.current) observer?.observe(readerElement.current);
    addEventListener("resize", resize);
    addEventListener("online", connection); addEventListener("offline", connection);
    setSpeechAvailable("speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function");
    return () => { observer?.disconnect(); removeEventListener("resize", resize); removeEventListener("online", connection); removeEventListener("offline", connection); };
  }, []);
  const step = wide && memory.layout === "spread" ? 2 : 1;
  const page = Math.min(memory.page, Math.max(0, book.pages.length - 1));
  useEffect(() => {
    setSpeaking(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    preparedAudio.current?.pause();
    if (moveFocus.current) { heading.current?.focus({ preventScroll: true }); moveFocus.current = false; }
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [page, step]);
  const go = (target: number) => { moveFocus.current = true; setMemory(m => ({ ...m, page: Math.max(0, Math.min(book.pages.length - 1, target)) })); };
  const chapters = book.pages.flatMap((p, i) => i === 0 || p.chapter !== book.pages[i - 1].chapter ? [{ title: p.chapter, page: i }] : []);
  const closeContents = () => { setContents(false); toggleContents.current?.focus(); };
  const readAloud = () => {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const text = book.pages.slice(page, page + step).map(p => [p.title, p.body, p.image?.alt, ...(p.reveals ?? []).map(r => `${r.label}. ${r.text}`)].filter(Boolean).join("\n")).join("\n");
    preparedAudio.current?.pause();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ""));
    utterance.rate = .9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setAudioNote("Device speech could not play. The reading is available as text."); };
    setAudioNote(""); speechSynthesis.cancel(); speechSynthesis.speak(utterance); setSpeaking(true);
  };
  return <main ref={readerElement} id="main-content" className={`${styles.reader} ${!wide ? styles.compact : ""} ${book.grade <= 3 ? styles.early : ""}`} style={{ "--reading-scale": memory.size } as CSSProperties} onKeyDown={e => {
    if (e.key === "Escape" && contents) { closeContents(); return; }
    const target = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || target.closest("button,input,select,textarea,a,summary,[contenteditable=true]")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(page + step); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(page - step); }
    if (e.key === "Home") { e.preventDefault(); go(0); }
    if (e.key === "End") { e.preventDefault(); go(book.pages.length - 1); }
  }}>
    <header className={styles.header}><Link href={backHref} className={styles.back}><ChevronLeft size={18} /> <span>Library</span></Link><div className={styles.brand}><BookOpen size={21} /> Liberia<span>Learn</span></div><span className={styles.edition}>{preview ? "Reviewer preview" : `Grade ${book.grade}`} · {book.subject}</span></header>
    <div className={styles.source}>{book.source === "demonstration" ? "SYNTHETIC DEMONSTRATION · Design showcase only. Not an approved or published textbook." : "AUTHORIZED READING · Curriculum reading presented as a book. Not a published textbook edition."}</div>
    <div className={styles.titlebar}><div><p className={styles.eyebrow}>THE READING ROOM</p><h1>{book.title}</h1></div><span className={styles.readingTag}>A little curiosity goes a long way.</span></div>
    <div className={styles.toolbar} aria-label="Reading controls">
      <button ref={toggleContents} type="button" aria-expanded={contents} aria-controls="textbook-contents" onClick={() => setContents(v => !v)}><List size={18} /> Contents</button>
      <div className={styles.fontControl}><button aria-label="Decrease font size" disabled={memory.size === 1} onClick={() => setMemory(m => ({ ...m, size: m.size === 1.3 ? 1.15 : 1 }))}><Minus size={16} /></button><span aria-label={`Font size ${Math.round(memory.size * 100)} percent`}>Aa</span><button aria-label="Increase font size" disabled={memory.size === 1.3} onClick={() => setMemory(m => ({ ...m, size: m.size === 1 ? 1.15 : 1.3 }))}><Plus size={16} /></button></div>
      <label className={styles.layoutControl}>Layout <select value={memory.layout} onChange={e => setMemory(m => ({ ...m, layout: e.target.value as ReaderMemory["layout"] }))}><option value="spread">Book spread</option><option value="single">Single page</option></select></label>
      <button aria-pressed={memory.bookmarks.includes(page)} onClick={() => setMemory(m => ({ ...m, bookmarks: m.bookmarks.includes(page) ? m.bookmarks.filter(p => p !== page) : [...m.bookmarks, page] }))}><Bookmark size={17} fill={memory.bookmarks.includes(page) ? "currentColor" : "none"} /> {memory.bookmarks.includes(page) ? "Bookmarked" : "Bookmark"}</button>
      <button disabled={!speechAvailable || !book.pages.length} aria-pressed={speaking} onClick={readAloud}><Volume2 size={18} /> {speaking ? "Stop reading" : "Read aloud"}</button>
    </div>
    {book.narration?.length ? <details className={styles.narration}><summary>Prepared lesson narration · {book.narration.length} part{book.narration.length > 1 ? "s" : ""}</summary><p>Existing narration for the full reading, rather than this page. All reading text remains available on screen.</p><label>Narration section <select value={narrationPart} onChange={e => { preparedAudio.current?.pause(); setNarrationPart(Number(e.target.value)); }}>{book.narration.map((part,i) => <option key={i} value={i}>{part.label}</option>)}</select></label><audio ref={preparedAudio} key={narrationPart} controls preload="none" src={book.narration[narrationPart]?.src} aria-label="Prepared reading narration" onPlay={() => { if ("speechSynthesis" in window) speechSynthesis.cancel(); setSpeaking(false); }} onError={() => setAudioNote("Prepared narration could not load. Check your connection; the text remains available.")} /></details> : null}
    <div className={styles.workspace}>
      <aside id="textbook-contents" className={`${styles.contents} ${contents ? styles.contentsOpen : ""}`} aria-label="Table of contents">
        <div className={styles.contentsTitle}>Inside this book <button onClick={closeContents} aria-label="Close contents"><X size={18} /></button></div>
        <div className={styles.tabs}><button aria-pressed={tab === "chapters"} onClick={() => setTab("chapters")}>Chapters</button><button aria-pressed={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>Bookmarks <span>{memory.bookmarks.length}</span></button></div>
        <nav aria-label={tab === "chapters" ? "Chapters" : "Bookmarks"}>{(tab === "chapters" ? chapters : memory.bookmarks.slice().sort((a,b) => a-b).map(p => ({ title: book.pages[p].title, page: p }))).map((item, i) => <button key={item.page} aria-current={page >= item.page && page < (chapters.find(c => c.page > item.page)?.page ?? book.pages.length) && tab === "chapters" ? "location" : undefined} className={styles.chapter} onClick={() => { go(item.page); setContents(false); }}><span className={styles.chapterNumber}>{String(i + 1).padStart(2, "0")}</span><span>{item.title}<small>Page {item.page + 1}</small></span></button>)}</nav>
        {tab === "bookmarks" && !memory.bookmarks.length && <p className={styles.empty}>Save a page with the Bookmark button. Find it here when you return.</p>}
        <div className={styles.sideNote}><BookOpen size={23} /><p>Make space for discovery.</p><small>Your place is saved {durable ? "on this device" : "in this browser tab"}. Reading aids do not track learning completion.</small></div>
      </aside>
      <section className={styles.stage} aria-label="Book reader"><div className={styles.chapterStrip}><span>{book.pages[page]?.chapter ?? "Reading unavailable"}</span><span>{book.pages.length ? `${page + 1} / ${book.pages.length}` : "No pages"}</span></div>
        {!ready ? <div className={styles.notice} role="status">Opening your book…</div> : !book.pages.length ? <div className={styles.notice}><h2>Reading content unavailable</h2><p>This entry has no usable learner reading text. Return to your library or ask your teacher for another reading.</p><Link href={backHref}>Return to library</Link></div> : <div role="region" aria-label="Book pages. Use left and right arrow keys to turn pages." tabIndex={0} className={`${styles.spread} ${step === 1 ? styles.single : ""}`} onTouchStart={e => {
          if ((e.target as HTMLElement).closest("button,input,select,a,summary")) { touch.current = null; return; }
          const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY };
        }} onTouchEnd={e => { const start = touch.current; touch.current = null; if (!start || !e.changedTouches[0]) return; const t = e.changedTouches[0]; const dx = t.clientX - start.x; const dy = t.clientY - start.y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? step : -step)); }}>
          {book.pages.slice(page, page + step).map((p, i) => <article key={`${book.id}:${page + i}`} className={styles.paper} aria-label={`Page ${page + i + 1}: ${p.title}`}><div className={styles.runningHead}>{book.subject} <span>CHAPTER {chapters.filter(c => c.page <= page + i).length.toString().padStart(2, "0")}</span></div><h2 ref={i === 0 ? heading : undefined} tabIndex={-1} className={p.citrus ? styles.opener : ""}>{p.title}</h2>{p.citrus && book.source === "demonstration" && <CitrusIllustration />}<div className={styles.prose}><ReactMarkdown skipHtml components={{ a: ({ children }) => <span>{children}</span>, img: ({ alt }) => <span className={styles.notice}>Embedded illustration unavailable. {alt}</span> }}>{p.body}</ReactMarkdown></div>{p.image && <PageImage key={p.image.src} image={p.image} />}{p.explorer && book.source === "demonstration" && <FractionExplorer />}{p.reveals?.map((reveal, n) => <details key={n} className={styles.reveal}><summary>{reveal.label}</summary><p>{reveal.text}</p></details>)}<footer className={styles.paperFoot}><span>LIBERIALEARN · {book.source === "demonstration" ? "DEMONSTRATION" : "READING"}</span><span>{page + i + 1}</span></footer></article>)}
        </div>}
        <nav className={styles.pageNav} aria-label="Page navigation"><button disabled={page === 0} onClick={() => go(page - step)}><ArrowLeft size={18} /> Previous</button><p role="status" aria-live="polite">{book.pages.length ? `Page${step === 2 && page + 1 < book.pages.length ? "s" : ""} ${page + 1}${step === 2 && page + 1 < book.pages.length ? `–${page + 2}` : ""} of ${book.pages.length}` : "No pages available"}<small>{page + step >= book.pages.length ? "End of reading" : "Use arrow keys or swipe to turn pages"}</small></p><button disabled={page + step >= book.pages.length} onClick={() => go(page + step)}>Next <ArrowRight size={18} /></button></nav>
      </section>
    </div>
    <div className={styles.statusFoot}><span><Check size={15} /> {offline ? "Offline · open pages remain readable" : "Reading available in this visit"}</span><span>Device voice · {speechAvailable ? "browser speech, not prepared narration" : "read aloud unavailable on this device"}</span></div>
    <p className={styles.offlineNote}>Offline reopening is not supported for this reader. Illustrations and device voices may need a connection. {book.narration?.length ? "Prepared lesson narration is available separately above." : "No current prepared narration is attached to this reading."}</p>
    {offline && <p className={styles.notice} role="status">You are offline. Keep this book open to read its loaded text. New readings and missing media require a connection.</p>}{storageNote && <p className={styles.notice} role="status">{storageNote}</p>}{audioNote && <p className={styles.notice} role="status">{audioNote}</p>}
  </main>;
}
