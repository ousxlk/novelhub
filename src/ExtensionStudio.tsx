import { useEffect, useRef, useState } from "react";
import { Puzzle, Plus, Download, Upload, Trash2, Globe2, FileJson, CheckCircle2, ChevronDown, Search, ChevronLeft, BookOpen, Loader2, RefreshCw, X, ExternalLink } from "lucide-react";

export type NovelSourceExtension = {
  manifestVersion: 1; id: string; name: string; version: string; language: string;
  description: string; icon: string; baseUrl: string; searchUrl: string;
  selectors: { novelList:string; novelTitle:string; novelLink:string; novelAuthor:string; novelDescription:string; chapterList:string; chapterTitle:string; chapterLink:string; chapterContent:string };
};
type NovelItem = { title:string; url:string; author:string; description:string; cover:string };
type ChapterItem = { title:string; url:string };
type ReadChapter = { title:string; text:string; url:string };
declare global { interface Window { novelHub?: { fetchPage:(url:string)=>Promise<{ok:boolean;status:number;html:string}> } } }

const emptyForm = {
  name:"", version:"1.0.0", language:"English", description:"", icon:"📚", baseUrl:"https://", searchUrl:"",
  novelList:".novel-item", novelTitle:"h3", novelLink:"a", novelAuthor:".author", novelDescription:".description",
  chapterList:".chapter-item", chapterTitle:"a", chapterLink:"a", chapterContent:".chapter-content"
};
const languages=["English","Arabic","French","Spanish","German","Japanese","Korean","Chinese","Portuguese","Other"];
const validUrl=(v:string)=>{try{const u=new URL(v);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}};
const safeId=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")||"my.novel.source";
const absolute=(href:string,base:string)=>{try{return new URL(href,base).href}catch{return ""}};
const textOf=(el:Element|null)=>el?.textContent?.replace(/\s+/g," ").trim()||"";
function selectAll(root:ParentNode, selector:string):Element[]{try{return selector?Array.from(root.querySelectorAll(selector)):[]}catch{return []}}
function selectOne(root:ParentNode, selector:string):Element|null{try{return selector?root.querySelector(selector):null}catch{return null}}
async function fetchHtml(url:string):Promise<string>{
  if(!validUrl(url)) throw new Error("This source produced an invalid page URL.");
  if(window.novelHub?.fetchPage){const r=await window.novelHub.fetchPage(url);if(!r.ok)throw new Error("The source returned HTTP "+r.status+".");return r.html;}
  const response=await fetch(url);if(!response.ok)throw new Error("The source returned HTTP "+response.status+".");
  return await response.text();
}
function posterOf(root:Element|null,base:string):string{
  if(!root)return "";
  const img=root.querySelector("img") as HTMLImageElement|null;
  const raw=img?.getAttribute("data-src")||img?.getAttribute("data-original")||img?.getAttribute("data-lazy-src")||img?.getAttribute("src")||img?.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]||"";
  if(raw)return absolute(raw,base);
  const styled=root.querySelector("[style*=background-image]") as HTMLElement|null;
  const match=(styled?.getAttribute("style")||"").match(/url\(["']?(.*?)["']?\)/i);
  return match?.[1]?absolute(match[1],base):"";
}
function parseNovels(html:string,source:NovelSourceExtension,base:string):NovelItem[]{
  const doc=new DOMParser().parseFromString(html,"text/html");
  const configured=selectAll(doc,source.selectors.novelList).map(node=>{
    const link=selectOne(node,source.selectors.novelLink) as HTMLAnchorElement|null;
    const img=(node.querySelector("img") as HTMLImageElement|null);
    const title=textOf(selectOne(node,source.selectors.novelTitle))||textOf(link)||link?.getAttribute("title")||img?.getAttribute("alt")||textOf(node);
    const url=absolute(link?.getAttribute("href")||((node as HTMLAnchorElement).getAttribute?.("href")||""),base);
    return {title:title.trim(),url,author:textOf(selectOne(node,source.selectors.novelAuthor)),description:textOf(selectOne(node,source.selectors.novelDescription)),cover:posterOf(node,base)};
  }).filter(n=>n.title.length>1&&n.url);
  if(configured.length)return uniqueNovels(configured);
  // Generic discovery: image posters, linked titles, semantic cards and common novel URL patterns.
  const candidates:Array<NovelItem & {score:number}>=[];
  doc.querySelectorAll("a[href]").forEach(anchor=>{
    const link=anchor as HTMLAnchorElement;
    const url=absolute(link.getAttribute("href")||"",base);
    if(!url||url===base||seenUrlIsExternalAsset(url)||url.startsWith("javascript:")||url.startsWith("mailto:"))return;
    let container:Element=anchor;
    for(let depth=0;depth<5&&container.parentElement;depth++){
      if(container.matches("article,li,[class*=book i],[class*=novel i],[class*=story i],[class*=card i],[class*=item i]"))break;
      if(container.parentElement.matches("article,li,[class*=book i],[class*=novel i],[class*=story i],[class*=card i],[class*=item i]")){container=container.parentElement;break;}
      container=container.parentElement;
    }
    const img=(anchor.querySelector("img")||container.querySelector("img")) as HTMLImageElement|null;
    const title=textOf(anchor)||link.getAttribute("title")||img?.getAttribute("alt")||textOf(container).slice(0,180);
    if(title.length<2||title.length>180||/^(home|login|register|sign in|sign up|next|previous|read more|search|menu|contact|about)$/i.test(title))return;
    const context=textOf(container);
    if(context.length>900)return;
    const cls=((container.getAttribute("class")||"")+" "+(anchor.getAttribute("class")||"")).toLowerCase();
    const pathHint=/novel|book|manga|story|series|fiction|作品|小说|رواية|روايات|كتاب|قصة/i.test(url+" "+cls);
    const hasImage=!!img;
    const semantic=container.matches("article,li")||/novel|book|manga|story|series|fiction|card|item/.test(cls);
    const score=(hasImage?5:0)+(pathHint?4:0)+(semantic?3:0)+(title.length>=4?1:0);
    if(score<4)return;
    candidates.push({title,url,author:"",description:"",cover:posterOf(container,base),score});
  });
  return uniqueNovels(candidates.sort((a,b)=>b.score-a.score).slice(0,300).map(({score,...item})=>item));
}
function uniqueNovels(items:NovelItem[]):NovelItem[]{
  const seen=new Set<string>();
  return items.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;});
}
function seenUrlIsExternalAsset(url:string):boolean{return /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip)(?:[?#]|$)/i.test(url);}
function parseChapters(html:string,source:NovelSourceExtension,base:string):ChapterItem[]{
  const doc=new DOMParser().parseFromString(html,"text/html");
  const configured=selectAll(doc,source.selectors.chapterList).map(node=>{
    const link=selectOne(node,source.selectors.chapterLink) as HTMLAnchorElement|null;
    const title=textOf(selectOne(node,source.selectors.chapterTitle))||textOf(link)||link?.getAttribute("title")||textOf(node);
    return {title,url:absolute(link?.getAttribute("href")||"",base)};
  }).filter(ch=>ch.title&&ch.url);
  if(configured.length)return uniqueChapters(configured);
  const found:ChapterItem[]=[];
  doc.querySelectorAll("a[href]").forEach(anchor=>{
    const link=anchor as HTMLAnchorElement;
    const url=absolute(link.getAttribute("href")||"",base);
    const title=textOf(link)||link.getAttribute("title")||"";
    if(!url||url===base||!title||title.length>180||seenUrlIsExternalAsset(url))return;
    if(/chapter|chap|episode|ep\.?\s*\d|volume|part\s*\d|الفصل|فصل|الحلقة|第\s*\d|卷\s*\d/i.test(title+" "+url))found.push({title,url});
  });
  return uniqueChapters(found);
}
function uniqueChapters(items:ChapterItem[]):ChapterItem[]{
  const seen=new Set<string>();
  return items.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;});
}
function nextCataloguePage(html:string,base:string):string{
  const doc=new DOMParser().parseFromString(html,"text/html");
  const link=doc.querySelector('a[rel~="next"], a[aria-label*="next" i], a[aria-label*="التالي"], a.next, .pagination a.next, a[title*="next" i]') as HTMLAnchorElement|null;
  if(link?.getAttribute("href"))return absolute(link.getAttribute("href")||"",base);
  const candidates=Array.from(doc.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  const next=candidates.find(a=>/^(next|older|more|التالي|بعد ذلك|›|»|→)$/i.test(textOf(a)));
  return next?absolute(next.getAttribute("href")||"",base):"";
}
function parseChapter(html:string,source:NovelSourceExtension):string{
  const doc=new DOMParser().parseFromString(html,"text/html");
  const root=selectOne(doc,source.selectors.chapterContent)||doc.querySelector("article")||doc.querySelector("main")||doc.body;
  root?.querySelectorAll("script,style,nav,header,footer,button,form,iframe").forEach(el=>el.remove());
  return (root?.textContent||"").replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function saveText(filename:string,content:string){
  const blob=new Blob(["\uFEFF"+content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ExtensionStudio(){
  const [form,setForm]=useState(emptyForm);
  const [sources,setSources]=useState<NovelSourceExtension[]>([]);
  const [message,setMessage]=useState("");
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [selected,setSelected]=useState<NovelSourceExtension|null>(null);
  const [novels,setNovels]=useState<NovelItem[]>([]);
  const [chapters,setChapters]=useState<ChapterItem[]>([]);
  const [selectedNovel,setSelectedNovel]=useState<NovelItem|null>(null);
  const [reading,setReading]=useState<ReadChapter|null>(null);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const [bulkProgress,setBulkProgress]=useState("");
  const importRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{try{const raw=localStorage.getItem("novelhub.sourceExtensions");if(raw)setSources(JSON.parse(raw))}catch{setSources([])}},[]);
  const persist=(next:NovelSourceExtension[])=>{setSources(next);localStorage.setItem("novelhub.sourceExtensions",JSON.stringify(next))};
  const update=(key:keyof typeof emptyForm,value:string)=>setForm(old=>({...old,[key]:value}));
  const makeManifest=():NovelSourceExtension=>({manifestVersion:1,id:safeId(form.name),name:form.name.trim(),version:form.version.trim()||"1.0.0",language:form.language,description:form.description.trim(),icon:form.icon.trim()||"📚",baseUrl:form.baseUrl.trim(),searchUrl:form.searchUrl.trim(),selectors:{novelList:form.novelList.trim(),novelTitle:form.novelTitle.trim(),novelLink:form.novelLink.trim(),novelAuthor:form.novelAuthor.trim(),novelDescription:form.novelDescription.trim(),chapterList:form.chapterList.trim(),chapterTitle:form.chapterTitle.trim(),chapterLink:form.chapterLink.trim(),chapterContent:form.chapterContent.trim()}});
  const create=()=>{if(!form.name.trim()||!validUrl(form.baseUrl)){setMessage("Enter a source name and a valid http(s) website URL.");return}const item=makeManifest();if(sources.some(s=>s.id===item.id)){setMessage("That source ID already exists. Change its name.");return}persist([...sources,item]);setMessage("Source added. Select it below to browse its novels.");setForm(emptyForm)};
  const downloadManifest=(item:NovelSourceExtension)=>saveText(item.id+".novelhub.json",JSON.stringify(item,null,2));
  const importFile=async(file?:File)=>{if(!file)return;try{const data=JSON.parse(await file.text()) as NovelSourceExtension;if(data.manifestVersion!==1||!data.name||!data.id||!validUrl(data.baseUrl)||!data.selectors)throw new Error("This is not a valid Novel Hub source manifest.");persist([...sources.filter(s=>s.id!==data.id),data]);setMessage("Source imported. Select it below to browse.");}catch(e){setMessage(e instanceof Error?e.message:"Could not import this file.")}if(importRef.current)importRef.current.value=""};
  const loadNovels=async(source:NovelSourceExtension,term="")=>{
    setSelected(source);setSelectedNovel(null);setReading(null);setChapters([]);setNovels([]);setError("");setLoading(true);
    try{
      let url=source.baseUrl;
      if(term.trim()&&source.searchUrl){url=source.searchUrl.replaceAll("{query}",encodeURIComponent(term.trim())).replaceAll("{search}",encodeURIComponent(term.trim()));url=absolute(url,source.baseUrl);}
      const collected:NovelItem[]=[];const visited=new Set<string>();
      for(let page=0;url&&page<8&&!visited.has(url);page++){
        visited.add(url);
        const html=await fetchHtml(url);
        collected.push(...parseNovels(html,source,url));
        const next=nextCataloguePage(html,url);
        if(!next||next===url||new URL(next).origin!==new URL(source.baseUrl).origin)break;
        url=next;
      }
      const items=uniqueNovels(collected);setNovels(items);
      if(!items.length)setError("No novel posters or title links were detected. Paste the website's catalogue/category URL rather than its homepage. Sites that render their catalogue only with JavaScript, require login, or block requests need a site-specific adapter.");
    }
    catch(e){setError(e instanceof Error?e.message:"Could not load this source.");}finally{setLoading(false)}
  };
  const openNovel=async(novel:NovelItem)=>{
    if(!selected)return;setSelectedNovel(novel);setReading(null);setChapters([]);setError("");setLoading(true);
    try{const html=await fetchHtml(novel.url);const items=parseChapters(html,selected,novel.url);setChapters(items);if(!items.length)setError("No chapters found. Adjust the chapter row, title and link selectors in this source's settings.");}
    catch(e){setError(e instanceof Error?e.message:"Could not load chapters.");}finally{setLoading(false)}
  };
  const openChapter=async(ch:ChapterItem)=>{
    if(!selected)return;setLoading(true);setError("");
    try{const html=await fetchHtml(ch.url);const body=parseChapter(html,selected);if(!body)throw new Error("The chapter page was empty. Check the Chapter content selector.");setReading({title:ch.title,text:body,url:ch.url});}
    catch(e){setError(e instanceof Error?e.message:"Could not load chapter.");}finally{setLoading(false)}
  };
  const downloadOne=(ch:ChapterItem)=>{if(!selectedNovel)return;void (async()=>{setBulkProgress("Preparing "+ch.title+"…");try{const html=await fetchHtml(ch.url);const body=parseChapter(html,selected!);saveText((selectedNovel.title+" - "+ch.title).replace(/[\\/:*?"<>|]/g,"-")+".txt",ch.title+"\n\n"+body);setBulkProgress("")}catch(e){setError(e instanceof Error?e.message:"Download failed.");setBulkProgress("")}})()};
  const downloadAll=async()=>{
    if(!selectedNovel||!selected||!chapters.length)return;setLoading(true);setError("");const collected:string[]=[];
    try{for(let i=0;i<chapters.length;i++){setBulkProgress("Downloading "+(i+1)+" / "+chapters.length);const html=await fetchHtml(chapters[i].url);collected.push(chapters[i].title+"\n\n"+parseChapter(html,selected));}saveText((selectedNovel.title).replace(/[\\/:*?"<>|]/g,"-")+".txt",selectedNovel.title+"\n\n"+collected.join("\n\n"+"—".repeat(30)+"\n\n"));setBulkProgress("All chapters downloaded.");}
    catch(e){setError(e instanceof Error?e.message:"Could not download all chapters.");}finally{setLoading(false)}
  };
  const field=(label:string,key:keyof typeof emptyForm,placeholder:string)=><label className="extension-field"><span>{label}</span><input value={form[key]} onChange={e=>update(key,e.target.value)} placeholder={placeholder}/></label>;
  const visibleNovels=novels.filter(n=>(n.title+" "+n.author+" "+n.description).toLowerCase().includes(search.toLowerCase()));
  return <section className="extension-studio">
    <div className="extension-heading"><div><span className="eyebrow"><Puzzle size={14}/> YOUR NOVEL SOURCES</span><h1>Extensions</h1><p>Add a novel website once, then browse its novels and chapters here.</p></div><div className="extension-heading-icon"><BookOpen size={35}/></div></div>
    {reading&&selectedNovel?<div className="source-reader"><button className="back-link" onClick={()=>setReading(null)}><ChevronLeft size={16}/> Back to chapters</button><span className="eyebrow">{selected?.name} · {selectedNovel.title}</span><h2>{reading.title}</h2><article className="source-chapter-text">{reading.text}</article><div className="source-reader-actions"><button className="secondary-btn" onClick={()=>saveText((reading.title).replace(/[\\/:*?"<>|]/g,"-")+".txt",reading.title+"\n\n"+reading.text)}><Download size={15}/> Download chapter</button><button className="secondary-btn" onClick={()=>window.open(reading.url,"_blank","noopener,noreferrer")}><ExternalLink size={15}/> Source page</button></div></div>
    : selectedNovel ? <div className="source-browser"><button className="back-link" onClick={()=>{setSelectedNovel(null);setChapters([]);setError("")}}><ChevronLeft size={16}/> Back to {selected?.name}</button><div className="source-browser-heading"><div><span className="eyebrow">{selected?.name} · NOVEL DETAILS</span><h2>{selectedNovel.title}</h2><p>{selectedNovel.author&&"by "+selectedNovel.author}{selectedNovel.description&&" · "+selectedNovel.description}</p></div><button className="secondary-btn small" onClick={()=>downloadAll()} disabled={!chapters.length||loading}><Download size={15}/> Download all chapters</button></div><div className="source-list-heading"><strong>Chapters ({chapters.length})</strong><span>Choose a chapter to read or download</span></div>{chapters.map((ch,i)=><div className="source-chapter-row" key={ch.url+i}><button className="source-chapter-open" onClick={()=>void openChapter(ch)}><BookOpen size={16}/><span>{i+1}. {ch.title}</span></button><button className="icon-btn" title="Download chapter" onClick={()=>downloadOne(ch)}><Download size={16}/></button></div>)}</div>
    : selected ? <div className="source-browser"><div className="source-browser-heading"><div><span className="eyebrow">{selected.language} SOURCE</span><h2>{selected.icon} {selected.name}</h2><p>{selected.description||selected.baseUrl}</p></div><div className="source-heading-actions"><button className="secondary-btn small" onClick={()=>void loadNovels(selected)} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="icon-btn" title="Close source" onClick={()=>{setSelected(null);setNovels([]);setError("")}}><X size={17}/></button></div></div><div className="source-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter loaded novels…"/><span>{visibleNovels.length} novels</span></div>{loading&&<div className="source-loading"><Loader2 size={22}/> Loading source…</div>}{error&&<div className="source-error">{error}</div>}<div className="source-novel-grid">{visibleNovels.map((n,i)=><button className="source-novel-poster" key={n.url+i} onClick={()=>void openNovel(n)} title={n.title} aria-label={"Open chapters for "+n.title}>{n.cover?<img src={n.cover} alt={n.title} loading="lazy"/>:<span className="source-poster-placeholder"><BookOpen size={28}/></span>}<span>{n.title}</span></button>)}</div></div>
    : <><div className="installed-extensions"><div className="section-heading"><div><span className="eyebrow">READY TO READ</span><h2>My sources</h2></div><span className="result-count">{sources.length} INSTALLED</span></div>{sources.length===0?<div className="extension-empty"><Puzzle size={25}/><strong>No sources installed yet</strong><span>Add a novel website below. Novel Hub will display its novels and chapters here.</span></div>:<div className="extension-list">{sources.map(source=><article className="extension-card" key={source.id}><div className="extension-icon">{source.icon}</div><div className="extension-card-info"><strong>{source.name}</strong><span>{source.language} · v{source.version}</span><small>{source.baseUrl}</small></div><div className="extension-card-actions"><button className="primary-btn small" onClick={()=>void loadNovels(source)}><BookOpen size={15}/> Browse novels</button><button className="icon-btn" title="Export source" onClick={()=>downloadManifest(source)}><Download size={16}/></button><button className="icon-btn danger" title="Remove source" onClick={()=>persist(sources.filter(s=>s.id!==source.id))}><Trash2 size={16}/></button></div></article>)}</div>}</div>
    <div className="extension-layout"><div className="extension-builder"><div className="extension-step"><span>01</span><div><strong>Add a novel website</strong><small>Enter the source URL and the page selectors used by that website.</small></div></div><div className="extension-form-grid">{field("Source name","name","e.g. My Novel Site")}{field("Version","version","1.0.0")}<label className="extension-field"><span>Language</span><select value={form.language} onChange={e=>update("language",e.target.value)}>{languages.map(l=><option key={l}>{l}</option>)}</select></label><label className="extension-field"><span>Icon / emoji</span><input value={form.icon} onChange={e=>update("icon",e.target.value)} maxLength={8}/></label><div className="extension-field full">{field("Website URL","baseUrl","https://example.com")}</div><div className="extension-field full">{field("Search URL template (optional)","searchUrl","https://example.com/search?q={query}")}<small>Use <code>{"{query}"}</code> where the search phrase belongs.</small></div><div className="extension-field full">{field("Description","description","What kind of novels are on this source?")}</div></div><button className="extension-advanced-toggle" onClick={()=>setShowAdvanced(!showAdvanced)}><span>02 · Website page selectors</span><ChevronDown size={16} className={showAdvanced?"rotated":""}/></button>{showAdvanced&&<><p className="extension-help">Selectors tell Novel Hub where to find novel cards, chapter links and chapter text. Each website may use different CSS selectors. If browsing finds nothing, inspect the website and adjust these fields.</p><div className="extension-form-grid selector-grid">{field("Novel card selector","novelList",".novel-item")}{field("Novel title selector","novelTitle","h3")}{field("Novel link selector","novelLink","a")}{field("Author selector","novelAuthor",".author")}{field("Description selector","novelDescription",".description")}{field("Chapter row selector","chapterList",".chapter-item")}{field("Chapter title selector","chapterTitle","a")}{field("Chapter link selector","chapterLink","a")}{field("Chapter content selector","chapterContent",".chapter-content")}</div></>}<div className="extension-form-footer"><span><Globe2 size={14}/> Live source reader · Manifest v1</span><button className="primary-btn" onClick={create}><Plus size={16}/> Add source</button></div>{message&&<div className="extension-message"><CheckCircle2 size={15}/>{message}</div>}</div><aside className="extension-side"><div className="extension-tip"><BookOpen size={21}/><strong>Browse inside the app</strong><p>Novel Hub reads the source page, lists novels, opens chapter lists and displays chapter text in its reader.</p></div><div className="extension-tip"><FileJson size={21}/><strong>Import & export</strong><p>Back up source settings as a .novelhub.json file and import them on another device.</p></div><button className="secondary-btn import-extension" onClick={()=>importRef.current?.click()}><Upload size={16}/> Import source file</button><input ref={importRef} type="file" accept=".json,.novelhub.json,application/json" hidden onChange={e=>void importFile(e.target.files?.[0])}/></aside></div></>}
    {loading&&selectedNovel&&<div className="source-loading"><Loader2 size={18}/> Loading…</div>}{bulkProgress&&<div className="extension-message">{bulkProgress}</div>}{error&&selectedNovel&&<div className="source-error">{error}</div>}
  </section>;
}
