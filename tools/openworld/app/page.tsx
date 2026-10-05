'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, X, ChevronRight, Music2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ResidentEditor from '@/components/ResidentEditor';
import MusicPlayer, { type MusicPlayerHandle } from '@/components/MusicPlayer';
import { emptyResidentDraft, residentName, pixelImage, validResidentDraft, validateResident, resolveAccountDraft, type Resident, type LocalDraftAlternative } from '@/lib/world';
import { supabase, supabaseURL, supabasePublishableKey } from '@/lib/supabase';
const emptyDraft = emptyResidentDraft;
const anonymousDraftKey = 'openworld-anonymous-draft';
const accountDraftKey = (id: string) => `openworld-draft:${id}`;
const accountDraftBackupKey = (id: string) => `openworld-draft-backup:${id}`;
function readDraft(key: string): Resident | null {
 try {
  const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
  if (!validResidentDraft(value)) return null;
  return {user_id:value.user_id,name:value.name,avatar:value.avatar,scenery:value.scenery,messages:value.messages,x:value.x,y:value.y};
 } catch { return null; }
}
export default function Home(){
 const [residents,setResidents]=useState<Resident[]>([]);const [selected,setSelected]=useState<Resident|null>(null);const [line,setLine]=useState(0);const [editor,setEditor]=useState(false);const [auth,setAuth]=useState(false);const [user,setUser]=useState<User|null>(null);const [draft,setDraft]=useState<Resident>(emptyDraft);const [notice,setNotice]=useState('');const [saving,setSaving]=useState(false);const [loading,setLoading]=useState(!!supabase);const [zoom,setZoom]=useState(1);const [pan,setPan]=useState({x:0,y:0});const [intro,setIntro]=useState(true);const [draftReady,setDraftReady]=useState(false);const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);const moved=useRef(false);const anonymousDraft=useRef<Resident>(emptyDraft());const adoptedAnonymous=useRef(false);const accountPosition=useRef<{x:number;y:number}|null>(null);const accountRequest=useRef(0);const request=useRef(0);const live=useRef(true);
 const [authResolved,setAuthResolved]=useState(!supabase);
 const [accountReady,setAccountReady]=useState(!supabase);
 const [accountLoading,setAccountLoading]=useState(!!supabase);
 const [accountError,setAccountError]=useState(false);
 const [accountReload,setAccountReload]=useState(0);
 const [alternatives,setAlternatives]=useState<LocalDraftAlternative[]>([]);
 const musicPlayer=useRef<MusicPlayerHandle>(null);
 const worldResidents=residents;
 const [editorMode,setEditorMode]=useState<'avatar'|'scenery'>('avatar');
 const openEditor=(mode:'avatar'|'scenery')=>{setEditorMode(mode);setEditor(true);};
 useEffect(()=>{
  const timer=setTimeout(()=>setIntro(false),2000);
  try {
   const resume=sessionStorage.getItem('openworld-resume-editor');
   if(resume){setEditorMode(resume==='scenery'?'scenery':'avatar');setEditor(true);sessionStorage.removeItem('openworld-resume-editor');}
   const legacy=readDraft('openworld-draft');
   if(legacy){const destination=legacy.user_id?accountDraftKey(legacy.user_id):anonymousDraftKey;if(!readDraft(destination))localStorage.setItem(destination,JSON.stringify(legacy));localStorage.removeItem('openworld-draft');}
   const saved=readDraft(anonymousDraftKey);
   anonymousDraft.current=saved?.user_id===''?saved:emptyDraft();
   setDraft(anonymousDraft.current);
  }catch{setNotice('浏览器未允许保存草稿，请在关闭前完成发布。');}
  setDraftReady(true);
  return()=>clearTimeout(timer);
 },[]);
 useEffect(()=>{
  if(!draftReady||!authResolved||!accountReady||draft.user_id!==(user?.id??''))return;
  try{localStorage.setItem(user?accountDraftKey(user.id):anonymousDraftKey,JSON.stringify(draft));if(!user)anonymousDraft.current=draft;}
  catch{setNotice('浏览器未允许保存草稿，请在关闭前完成发布。');}
 },[draft,draftReady,authResolved,accountReady,user]);
 const refresh=useCallback(async()=>{if(!supabase)return;const seq=++request.current;const {data,error}=await supabase.from('residents').select('*').order('created_at',{ascending:true});if(!live.current||seq!==request.current)return;if(error)setNotice(error.code==='PGRST205'?'数据库尚未初始化。':'暂时无法读取世界，请稍后重试。');else setResidents((data||[]) as Resident[]);setLoading(false);},[]);
 useEffect(()=>{
  if(!supabase)return;live.current=true;let mounted=true;const client=supabase;
  client.auth.getSession().then(({data,error})=>{if(mounted){setUser(data.session?.user??null);setAuthResolved(true);if(error)setNotice('登录状态读取失败，请重试。');}}).catch(()=>{if(mounted){setAuthResolved(true);setNotice('登录状态读取失败，请重试。');}});
  const {data:listener}=client.auth.onAuthStateChange((_,session)=>{setUser(session?.user??null);setAuthResolved(true);if(session)setAuth(false);});
  void refresh();const channel=client.channel('world-residents').on('postgres_changes',{event:'*',schema:'public',table:'residents'},()=>void refresh()).subscribe();const timer=setInterval(()=>void refresh(),30000);
  return()=>{mounted=false;live.current=false;listener.subscription.unsubscribe();void client.removeChannel(channel);clearInterval(timer);};
 },[refresh]);
 // Load the owner's row independently; a failed read must never resemble a new account.
 useEffect(()=>{
  if(!draftReady||!authResolved)return;const seq=++accountRequest.current;let active=true;
  setAccountReady(false);setAccountError(false);setAlternatives([]);adoptedAnonymous.current=false;accountPosition.current=null;
  if(!user){setDraft(anonymousDraft.current);setAccountLoading(false);setAccountReady(true);return()=>{active=false;};}
  const client=supabase;if(!client)return;const userId=user.id;const local=readDraft(accountDraftBackupKey(userId))??readDraft(accountDraftKey(userId));setAccountLoading(true);
  void(async()=>{
   try{
    const {data,error}=await client.from('residents').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;
    if(!active||seq!==accountRequest.current)return;
    if(data&&!validResidentDraft(data))throw new Error('无法读取已保存的形象。');
    const saved=data as Resident|null;const resolved=resolveAccountDraft(userId,saved,anonymousDraft.current,local);
    const localAlternative=resolved.alternatives.find(alternative=>alternative.kind==='account');
    if(localAlternative)try{localStorage.setItem(accountDraftBackupKey(userId),JSON.stringify(localAlternative.draft));}catch{}
    accountPosition.current=saved?{x:saved.x,y:saved.y}:null;adoptedAnonymous.current=resolved.adoptedAnonymous;
    setDraft(resolved.draft);setAlternatives(resolved.alternatives);setAccountReady(true);
   }catch{if(active&&seq===accountRequest.current){setAccountError(true);setNotice('无法读取你的形象，请重新读取后再保存。本机草稿已保留。');}}
   finally{if(active&&seq===accountRequest.current)setAccountLoading(false);}
  })();
  return()=>{active=false;};
 },[draftReady,authResolved,user?.id,accountReload]);
 const openResident=useCallback((r:Resident)=>{setSelected(r);setLine(0);},[]);
 useEffect(()=>{const context=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>void}}).modelContext;if(!context)return;const lifecycle=new AbortController();try{context.registerTool({name:'open_resident_dialogue',description:'打开一个居民的对话，不保存或修改数据。',inputSchema:{type:'object',properties:{residentId:{type:'string'}},required:['residentId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||!('residentId'in input)||typeof input.residentId!=='string')throw new Error('需要 residentId。');const r=worldResidents.find(v=>v.user_id===input.residentId);if(!r)throw new Error('居民不存在。');openResident(r);return {residentId:r.user_id,name:residentName(r.name),message:r.messages[0].text};}},{signal:lifecycle.signal});}catch{}return()=>lifecycle.abort();},[worldResidents,openResident]);
 const login=async(provider:'google'|'github')=>{
  if(!supabase){setNotice('登录尚未连接：需要配置 Supabase 项目并启用 Google / GitHub。你的绘画草稿已保留。');return;}
  setSaving(true);
  try{
   const response=await fetch(`${supabaseURL}/auth/v1/settings`,{headers:{apikey:supabasePublishableKey!}});if(!response.ok)throw new Error('登录服务暂时不可用。');
   const settings=await response.json() as {external?:Record<string,boolean>};if(!settings.external?.[provider])throw new Error(`${provider==='google'?'Google':'GitHub'} 登录尚未在 Supabase 启用。`);
   try{localStorage.setItem(user?accountDraftKey(user.id):anonymousDraftKey,JSON.stringify(draft));if(!user)anonymousDraft.current=draft;if(editor)sessionStorage.setItem('openworld-resume-editor',editorMode);}
   catch{setNotice('浏览器未允许保存草稿，请保留当前页面。');return;}
   const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:`${window.location.origin}${window.location.pathname}`}});if(error)throw error;
  }catch(error){setNotice(error instanceof Error?error.message:'登录服务暂时不可用，请稍后重试。');}
  finally{setSaving(false);}
 };
 const signOut=async()=>{
  if(!supabase)return;setSaving(true);
  try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;setUser(null);setAuth(false);}
  catch{setNotice('退出失败，请重试。');}finally{setSaving(false);}
 };
 const useLocalDraft=(alternative:LocalDraftAlternative)=>{
  if(!user||!accountReady)return;adoptedAnonymous.current=alternative.kind==='anonymous';
  if(alternative.kind==='account')try{localStorage.removeItem(accountDraftBackupKey(user.id));}catch{}
  setDraft({...alternative.draft,user_id:user.id,...(accountPosition.current??{})});setAlternatives([]);
  setNotice('已载入本机草稿。点击保存后才会替换已保存形象。');
 };
 const keepSavedDraft=()=>{
  if(user)try{localStorage.removeItem(accountDraftBackupKey(user.id));}catch{}
  setAlternatives([]);
 };
 const save=async()=>{
  if(!authResolved||!accountReady)return;if(!user){setAuth(true);return;}
  const err=validateResident(draft);if(err){setNotice(err);return;}if(!supabase)return;
  if(draft.user_id!==user.id){setNotice('草稿不属于当前账号，请重新读取形象。');return;}
  const accountSeq=accountRequest.current;setSaving(true);
  try{
   const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
   if(sessionData.session?.user.id!==user.id){setUser(sessionData.session?.user??null);setNotice('登录状态已改变，请重新读取形象后保存。');return;}
   const position=accountPosition.current??{x:20+Math.random()*60,y:25+Math.random()*50};
   const payload:Resident={user_id:user.id,name:draft.name.trim(),avatar:draft.avatar,scenery:draft.scenery,messages:draft.messages,...position};
   const {data,error}=await supabase.from('residents').upsert(payload,{onConflict:'user_id'}).select('*').single();if(error)throw error;
   if(!validResidentDraft(data)||data.user_id!==user.id)throw new Error('保存结果读取失败。');
   if(accountSeq!==accountRequest.current)return;
   try{localStorage.removeItem(accountDraftBackupKey(user.id));}catch{}
   setDraft(data);accountPosition.current={x:data.x,y:data.y};setAlternatives([]);
   if(adoptedAnonymous.current){anonymousDraft.current=emptyDraft();try{localStorage.setItem(anonymousDraftKey,JSON.stringify(anonymousDraft.current));}catch{}adoptedAnonymous.current=false;}
   setEditor(false);setNotice('已保存。');await refresh();
  }catch(error){setNotice(error instanceof Error?error.message:'保存失败，草稿仍保留，请稍后重试。');}
  finally{setSaving(false);}
 };
 const next=()=>{setLine(n=>n+1);};const current=selected?.messages[line];
 return <main className="openworld"><a className="world-brand" href="./" aria-label="自由 · openworld"><span>（自由）</span><small>openworld</small></a>{intro&&<div className="intro" aria-hidden="true">（自由）</div>}<section className="world" aria-label="自由世界，拖动空白处漫游" onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};moved.current=false;}} onPointerMove={e=>{if(drag.current){const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>4)moved.current=true;setPan({x:drag.current.px+dx,y:drag.current.py+dy});}}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}><div className="world-content" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>{worldResidents.map(r=><button className="resident" key={r.user_id} style={{left:`${r.x}%`,top:`${r.y}%`}} onClick={()=>{openResident(r);}}><img className="scenery" src={pixelImage(r.scenery)} alt=""/><img src={pixelImage(r.avatar)} alt={residentName(r.name)}/><span>{residentName(r.name)}</span></button>)}</div>{loading&&<span className="sr-only" role="status">加载中</span>}</section><nav className="world-actions" aria-label="绘画"><Button onClick={()=>openEditor('avatar')}>（你）</Button><Button onClick={()=>openEditor('scenery')}>（世界）</Button></nav>
 <Dialog open={!!selected} onOpenChange={open=>{if(!open){setSelected(null);}}}><DialogContent className="dialogue-modal" showCloseButton={false}><DialogTitle className="sr-only">与{residentName(selected?.name)}对话</DialogTitle><DialogDescription className="sr-only">逐条阅读居民留下的话，也可以手动开启音乐。</DialogDescription>{selected&&current&&<><Button className="close" aria-label="关闭对话" onClick={()=>{setSelected(null);}}><X/></Button><div className="dialogue-body"><img src={pixelImage(selected.avatar)} alt=""/><div><small>{residentName(selected.name)}</small><p key={line}>{current.text}</p></div></div><div className="dialogue-controls"><span>{String(line+1).padStart(2,'0')} / {String(selected.messages.length).padStart(2,'0')}</span>{current.soundcloud?<Button className="music-toggle" onClick={()=>musicPlayer.current?.play(current.soundcloud,{residentId:selected.user_id,name:residentName(selected.name)})}><Music2 size={15}/>播放音乐</Button>:null}<Button className="quiet" onClick={()=>line+1<selected.messages.length?next():setSelected(null)}>{line+1<selected.messages.length?'继续':'关闭'}<ChevronRight size={14}/></Button></div></>}</DialogContent></Dialog>
 <Dialog open={editor} onOpenChange={setEditor}><DialogContent className="editor-modal"><DialogTitle className="editor-title">{editorMode==='avatar'?'（你）':'（世界）'}</DialogTitle><DialogDescription className="sr-only">50×50 像素画布</DialogDescription><ResidentEditor key={editorMode} mode={editorMode} draft={draft} onChange={next=>{if(draftReady&&authResolved&&accountReady&&next.user_id===(user?.id??''))setDraft(next);}} onSave={()=>void save()} saving={saving} signedIn={!!user} accountReady={draftReady&&authResolved&&accountReady} accountLoading={accountLoading} accountError={accountError} onLogin={()=>setAuth(true)} onSignOut={()=>void signOut()} onRetryAccount={()=>setAccountReload(n=>n+1)} alternatives={alternatives} onUseLocalDraft={useLocalDraft} onKeepSaved={keepSavedDraft}/></DialogContent></Dialog>
 <Dialog open={auth} onOpenChange={setAuth}><DialogContent className="auth-modal"><DialogTitle className="auth-title">登录</DialogTitle><DialogDescription className="sr-only">选择登录方式</DialogDescription><Button className="oauth" disabled={saving} onClick={()=>void login('google')}><span className="google-mark">G</span>使用 Google 登录<ArrowUpRight size={16}/></Button><Button className="oauth" disabled={saving} onClick={()=>void login('github')}><Code2 size={18}/>使用 GitHub 登录<ArrowUpRight size={16}/></Button>{!supabase&&<p className="connection-note">尚未连接 Supabase。草稿已保留。</p>}<Button className="wander" onClick={()=>setAuth(false)}>关闭</Button></DialogContent></Dialog>
 <MusicPlayer ref={musicPlayer}/>
 {notice&&<div className="notice" role="status"><span>{notice}</span>{supabase&&notice.includes('读取世界')&&<Button className="quiet" onClick={()=>void refresh()}>刷新</Button>}<Button aria-label="关闭提示" className="icon-button" onClick={()=>setNotice('')}><X size={16}/></Button></div>}
 </main>;
}
