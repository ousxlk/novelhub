import { useEffect, useRef, useState } from "react";
import { Puzzle, Plus, Download, Upload, Trash2, ExternalLink, Globe2, FileJson, CheckCircle2, ChevronDown, Copy } from "lucide-react";

export type NovelSourceExtension = {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  language: string;
  description: string;
  icon: string;
  baseUrl: string;
  searchUrl: string;
  selectors: {
    novelList: string;
    novelTitle: string;
    novelLink: string;
    novelAuthor: string;
    novelDescription: string;
    chapterList: string;
    chapterTitle: string;
    chapterLink: string;
    chapterContent: string;
  };
};

const emptyForm = {
  name: "", version: "1.0.0", language: "English", description: "",
  icon: "📚", baseUrl: "https://", searchUrl: "",
  novelList: ".novel-item", novelTitle: "h3", novelLink: "a",
  novelAuthor: ".author", novelDescription: ".description",
  chapterList: ".chapter-item", chapterTitle: "a", chapterLink: "a",
  chapterContent: ".chapter-content"
};
const languages = ["English","Arabic","French","Spanish","German","Japanese","Korean","Chinese","Portuguese","Other"];
const validUrl = (value: string) => { try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };
const safeId = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"") || "my.novel.source";

export default function ExtensionStudio() {
  const [form,setForm] = useState(emptyForm);
  const [sources,setSources] = useState<NovelSourceExtension[]>([]);
  const [message,setMessage] = useState("");
  const [showAdvanced,setShowAdvanced] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { const raw=localStorage.getItem("novelhub.sourceExtensions"); if(raw) setSources(JSON.parse(raw)); } catch { setSources([]); }
  },[]);
  const persist = (next: NovelSourceExtension[]) => { setSources(next); localStorage.setItem("novelhub.sourceExtensions",JSON.stringify(next)); };
  const update = (key: keyof typeof emptyForm, value: string) => setForm(old=>({...old,[key]:value}));
  const makeManifest = (): NovelSourceExtension => ({
    manifestVersion:1, id:safeId(form.name), name:form.name.trim(), version:form.version.trim()||"1.0.0",
    language:form.language, description:form.description.trim(), icon:form.icon.trim()||"📚",
    baseUrl:form.baseUrl.trim(), searchUrl:form.searchUrl.trim(),
    selectors:{novelList:form.novelList.trim(),novelTitle:form.novelTitle.trim(),novelLink:form.novelLink.trim(),novelAuthor:form.novelAuthor.trim(),novelDescription:form.novelDescription.trim(),chapterList:form.chapterList.trim(),chapterTitle:form.chapterTitle.trim(),chapterLink:form.chapterLink.trim(),chapterContent:form.chapterContent.trim()}
  });
  const create = () => {
    if(!form.name.trim() || !validUrl(form.baseUrl)) { setMessage("Add a source name and a valid http(s) website URL first."); return; }
    const item=makeManifest();
    if(sources.some(s=>s.id===item.id)){setMessage("An extension with this ID already exists. Change the source name.");return;}
    persist([...sources,item]); setMessage("Extension created and saved in this app."); setForm(emptyForm);
  };
  const download = (item: NovelSourceExtension) => {
    const blob=new Blob([JSON.stringify(item,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=item.id+".novelhub.json"; a.click(); URL.revokeObjectURL(url);
  };
  const importFile = async (file?: File) => {
    if(!file) return;
    try {
      const data=JSON.parse(await file.text()) as NovelSourceExtension;
      if(data.manifestVersion!==1 || !data.name || !data.id || !validUrl(data.baseUrl) || !data.selectors) throw new Error("This file is not a valid Novel Hub source manifest.");
      const next=[...sources.filter(s=>s.id!==data.id),data]; persist(next); setMessage("Extension imported successfully.");
    } catch(e) { setMessage(e instanceof Error?e.message:"Could not import this file."); }
    if(importRef.current) importRef.current.value="";
  };
  const field = (label:string,key:keyof typeof emptyForm,placeholder:string) => <label className="extension-field"><span>{label}</span><input value={form[key]} onChange={e=>update(key,e.target.value)} placeholder={placeholder}/></label>;
  return <section className="extension-studio">
    <div className="extension-heading"><div><span className="eyebrow"><Puzzle size={14}/> BUILD YOUR OWN SOURCES</span><h1>Extension Studio</h1><p>Create a source profile for a web-novel website. No programming required.</p></div><div className="extension-heading-icon"><Puzzle size={35}/></div></div>
    <div className="extension-layout">
      <div className="extension-builder">
        <div className="extension-step"><span>01</span><div><strong>Source details</strong><small>Give your extension a name and website.</small></div></div>
        <div className="extension-form-grid">
          {field("Extension name","name","e.g. My Favorite Novels")}
          {field("Version","version","1.0.0")}
          <label className="extension-field"><span>Language</span><select value={form.language} onChange={e=>update("language",e.target.value)}>{languages.map(l=><option key={l}>{l}</option>)}</select></label>
          <label className="extension-field"><span>Icon / emoji</span><input value={form.icon} onChange={e=>update("icon",e.target.value)} maxLength={8}/></label>
          <div className="extension-field full">{field("Website URL","baseUrl","https://example.com")}</div>
          <div className="extension-field full">{field("Search URL template (optional)","searchUrl","https://example.com/search?q={query}")}<small>Use <code>{"{query}"}</code> where the search words should go.</small></div>
          <div className="extension-field full">{field("Short description","description","What kind of novels does this source provide?")}</div>
        </div>
        <button className="extension-advanced-toggle" onClick={()=>setShowAdvanced(!showAdvanced)}><span>02 · Page selectors (advanced)</span><ChevronDown size={16} className={showAdvanced?"rotated":""}/></button>
        {showAdvanced&&<><p className="extension-help">These are CSS selectors that describe where the website keeps its novel titles, links, chapter list, and chapter text. You can leave the defaults and edit them later.</p><div className="extension-form-grid selector-grid">
          {field("Novel card selector","novelList",".novel-item")}
          {field("Novel title selector","novelTitle","h3")}
          {field("Novel link selector","novelLink","a")}
          {field("Author selector","novelAuthor",".author")}
          {field("Description selector","novelDescription",".description")}
          {field("Chapter row selector","chapterList",".chapter-item")}
          {field("Chapter title selector","chapterTitle","a")}
          {field("Chapter link selector","chapterLink","a")}
          {field("Chapter text selector","chapterContent",".chapter-content")}
        </div></>}
        <div className="extension-form-footer"><span><Globe2 size={14}/> Manifest format · Novel Hub v1</span><button className="primary-btn" onClick={create}><Plus size={16}/> Create extension</button></div>
        {message&&<div className="extension-message"><CheckCircle2 size={15}/>{message}</div>}
      </div>
      <aside className="extension-side">
        <div className="extension-tip"><FileJson size={21}/><strong>What is an extension?</strong><p>A small source profile that describes a novel website, its language, search pattern, and page structure.</p></div>
        <div className="extension-tip"><Download size={21}/><strong>Export & share</strong><p>Download a <code>.novelhub.json</code> manifest to back it up or share it with another Novel Hub user.</p></div>
        <button className="secondary-btn import-extension" onClick={()=>importRef.current?.click()}><Upload size={16}/> Import extension file</button>
        <input ref={importRef} type="file" accept=".json,.novelhub.json,application/json" hidden onChange={e=>void importFile(e.target.files?.[0])}/>
      </aside>
    </div>
    <div className="installed-extensions"><div className="section-heading"><div><span className="eyebrow">YOUR SOURCE COLLECTION</span><h2>My extensions</h2></div><span className="result-count">{sources.length} INSTALLED</span></div>
      {sources.length===0?<div className="extension-empty"><Puzzle size={25}/><strong>No extensions yet</strong><span>Create your first source above or import a manifest file.</span></div>:<div className="extension-list">{sources.map(source=><article className="extension-card" key={source.id}><div className="extension-icon">{source.icon}</div><div className="extension-card-info"><strong>{source.name}</strong><span>{source.language} · v{source.version}</span><small>{source.baseUrl}</small></div><div className="extension-card-actions"><button className="icon-btn" title="Open website" onClick={()=>window.open(source.baseUrl,"_blank","noopener,noreferrer")}><ExternalLink size={16}/></button><button className="icon-btn" title="Export manifest" onClick={()=>download(source)}><Download size={16}/></button><button className="icon-btn danger" title="Remove extension" onClick={()=>persist(sources.filter(s=>s.id!==source.id))}><Trash2 size={16}/></button></div></article>)}</div>}
    </div>
  </section>;
}
