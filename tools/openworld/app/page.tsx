'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, X, ChevronRight, Music2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ResidentEditor from '@/components/ResidentEditor';
import MusicPlayer, { type MusicPlayerHandle } from '@/components/MusicPlayer';
import WorldCanvas from '@/components/WorldCanvas';
import { emptyResidentDraft, residentName, pixelImage, validResidentDraft, validateResident, resolveAccountDraft, type Resident, type LocalDraftAlternative } from '@/lib/world';
import { canMoveResident, residentPositions, type ResidentPositions, type PositionPatch } from '@/lib/positions';
import { supabase, supabaseURL, supabasePublishableKey } from '@/lib/supabase';
import { restoreAuthSession } from '@/lib/auth';
import './dialogue.css';
const emptyDraft = emptyResidentDraft;
const anonymousDraftKey = 'openworld-anonymous-draft';
const accountDraftKey = (id: string) => `openworld-draft:${id}`;
const accountDraftBackupKey = (id: string) => `openworld-draft-backup:${id}`;
function readDraft(key: string): Resident | null {
 try {
  const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
  if (!validResidentDraft(value)) return null;
  return {user_id:value.user_id,name:value.name,avatar:value.avatar,scenery:value.scenery,messages:value.messages,x:value.x,y:value.y,scenery_x:value.scenery_x,scenery_y:value.scenery_y};
 } catch { return null; }
}
export default function Home(){
 const [residents,setResidents]=useState<Resident[]>([]);const [selected,setSelected]=useState<Resident|null>(null);const [line,setLine]=useState(0);const [editor,setEditor]=useState(false);const [auth,setAuth]=useState(false);const [user,setUser]=useState<User|null>(null);const [draft,setDraft]=useState<Resident>(emptyDraft);const [notice,setNotice]=useState('');const [saving,setSaving]=useState(false);const [positionBusy,setPositionBusy]=useState(false);const [loading,setLoading]=useState(!!supabase);const [zoom]=useState(1);const [pan,setPan]=useState({x:0,y:0});const [intro,setIntro]=useState(true);const [draftReady,setDraftReady]=useState(false);const anonymousDraft=useRef<Resident>(emptyDraft());const adoptedAnonymous=useRef(false);const accountPosition=useRef<ResidentPositions|null>(null);const accountRequest=useRef(0);const request=useRef(0);const live=useRef(true);const currentOwner=useRef<string|null>(null);currentOwner.current=user?.id??null;const pendingPosition=useRef<{residentId:string;patch:PositionPatch}|null>(null);
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
 const refresh=useCallback(async()=>{if(!supabase)return;const seq=++request.current;const {data,error}=await supabase.from('residents').select('*').order('created_at',{ascending:true});if(!live.current||seq!==request.current)return;if(error)setNotice(error.code==='PGRST205'?'数据库尚未初始化。':'暂时无法读取世界，请稍后重试。');else{const pending=pendingPosition.current;const rows=((data||[]) as Resident[]).map(resident=>resident.user_id===pending?.residentId?{...resident,...pending.patch}:resident);setResidents(rows);const own=rows.find(row=>row.user_id===currentOwner.current);if(own){const position=residentPositions(own);accountPosition.current=position;setDraft(value=>value.user_id===own.user_id?{...value,...position}:value);}}setLoading(false);},[]);
 useEffect(()=>{
  if(!supabase)return;live.current=true;let mounted=true;const client=supabase;
  restoreAuthSession(client.auth,{readURL:()=>window.location.href,replaceURL:url=>window.history.replaceState(window.history.state,'',url)}).then(({session,notice:authNotice})=>{if(mounted){setUser(session?.user??null);setAuthResolved(true);if(authNotice)setNotice(authNotice);}}).catch(()=>{if(mounted){setAuthResolved(true);setNotice('登录状态读取失败，请重试。');}});
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
    const pending=pendingPosition.current;const saved=data?(pending&&data.user_id===pending.residentId?{...data,...pending.patch}:data) as Resident:null;const resolved=resolveAccountDraft(userId,saved,anonymousDraft.current,local);
    const localAlternative=resolved.alternatives.find(alternative=>alternative.kind==='account');
    if(localAlternative)try{localStorage.setItem(accountDraftBackupKey(userId),JSON.stringify(localAlternative.draft));}catch{}
    accountPosition.current=saved?residentPositions(saved):null;adoptedAnonymous.current=resolved.adoptedAnonymous;
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
 const moveResident=async(resident:Resident,patch:PositionPatch)=>{
  const ownerId=user?.id;if(!supabase||!canMoveResident(ownerId,resident.user_id)||!accountReady||saving||pendingPosition.current)return;
  const accountSeq=accountRequest.current;const previous=residentPositions(resident);const next={...previous,...patch};const pending={residentId:resident.user_id,patch};pendingPosition.current=pending;request.current++;setPositionBusy(true);
  setResidents(rows=>rows.map(row=>row.user_id===ownerId?{...row,...patch}:row));accountPosition.current=next;setDraft(value=>value.user_id===ownerId?{...value,...next}:value);
  try{
   const {data:session,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
   if(session.session?.user.id!==ownerId)throw new Error('登录状态已改变，位置未保存。');
   if(currentOwner.current!==ownerId||accountRequest.current!==accountSeq)throw new Error('登录状态已改变，位置未保存。');
   const {data,error}=await supabase.from('residents').update(patch).eq('user_id',ownerId).select('user_id,x,y,scenery_x,scenery_y').single();if(error)throw error;
   if(!data||data.user_id!==ownerId)throw new Error('位置保存失败。');
   const saved=residentPositions(data);setResidents(rows=>rows.map(row=>row.user_id===ownerId?{...row,...saved}:row));
   if(currentOwner.current===ownerId&&accountRequest.current===accountSeq){accountPosition.current=saved;setDraft(value=>value.user_id===ownerId?{...value,...saved}:value);}
  }catch(error){
   setResidents(rows=>rows.map(row=>row.user_id===ownerId?{...row,...previous}:row));
   if(currentOwner.current===ownerId&&accountRequest.current===accountSeq){accountPosition.current=previous;setDraft(value=>value.user_id===ownerId?{...value,...previous}:value);setNotice(error instanceof Error?error.message:'位置保存失败，请重试。');}
  }finally{
   if(pendingPosition.current===pending){request.current++;pendingPosition.current=null;setPositionBusy(false);void refresh();}
  }
 };
 const save=async()=>{
  if(!authResolved||!accountReady||positionBusy||pendingPosition.current)return;if(!user){setAuth(true);return;}
  const err=validateResident(draft);if(err){setNotice(err);return;}if(!supabase)return;
  if(draft.user_id!==user.id){setNotice('草稿不属于当前账号，请重新读取形象。');return;}
  const accountSeq=accountRequest.current;setSaving(true);
  try{
   const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
   if(sessionData.session?.user.id!==user.id){setUser(sessionData.session?.user??null);setNotice('登录状态已改变，请重新读取形象后保存。');return;}
   const position=accountPosition.current??residentPositions({x:20+Math.random()*60,y:25+Math.random()*50});
   const payload:Resident={user_id:user.id,name:draft.name.trim(),avatar:draft.avatar,scenery:draft.scenery,messages:draft.messages,...position};
   const {data,error}=await supabase.from('residents').upsert(payload,{onConflict:'user_id'}).select('*').single();if(error)throw error;
   if(!validResidentDraft(data)||data.user_id!==user.id)throw new Error('保存结果读取失败。');
   if(accountSeq!==accountRequest.current)return;
   try{localStorage.removeItem(accountDraftBackupKey(user.id));}catch{}
   setDraft(data);accountPosition.current=residentPositions(data);setAlternatives([]);
   if(adoptedAnonymous.current){anonymousDraft.current=emptyDraft();try{localStorage.setItem(anonymousDraftKey,JSON.stringify(anonymousDraft.current));}catch{}adoptedAnonymous.current=false;}
   setEditor(false);setNotice('已保存。');await refresh();
  }catch(error){setNotice(error instanceof Error?error.message:'保存失败，草稿仍保留，请稍后重试。');}
  finally{setSaving(false);}
 };
 const next=()=>{setLine(n=>n+1);};const current=selected?.messages[line];
 return <main className="openworld"><a className="world-brand" href="./" aria-label="自由 · openworld"><span>（自由）</span><small>openworld</small></a>{intro&&<div className="intro" aria-hidden="true">（自由）</div>}<WorldCanvas residents={worldResidents} ownerId={user?.id??null} moving={saving||positionBusy||!accountReady} loading={loading} zoom={zoom} pan={pan} onPan={setPan} onOpen={openResident} onMove={(resident,patch)=>void moveResident(resident,patch)}/><nav className="world-actions" aria-label="绘画"><Button onClick={()=>openEditor('avatar')}>（你）<small>You</small></Button><Button onClick={()=>openEditor('scenery')}>（世界）<small>World</small></Button></nav>
 <Dialog modal={false} open={!!selected} onOpenChange={open=>{if(!open){setSelected(null);}}}>
  <DialogContent className="dialogue-modal translate-x-0 translate-y-0" showCloseButton={false} aria-modal={false}
   onInteractOutside={event=>{const target=event.detail.originalEvent.target;if(target instanceof Element&&target.closest('.music-player, .world-drawing'))event.preventDefault();}}
   onKeyDown={event=>{
    if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button=>button.tabIndex>=0&&button.getClientRects().length>0);
    const edge=event.shiftKey?buttons[0]:buttons.at(-1);
    if(document.activeElement===edge&&musicPlayer.current?.focus(event.shiftKey?'last':'first'))event.preventDefault();
   }}>
   <DialogTitle className="sr-only">与{residentName(selected?.name)}对话</DialogTitle>
   <DialogDescription className="sr-only">逐条阅读居民留下的话，也可以手动开启音乐。</DialogDescription>
   {selected&&current&&<>
    <Button className="dialogue-close" variant="ghost" aria-label="关闭对话" onClick={()=>setSelected(null)}><X/></Button>
    <div className="dialogue-body" key={line}>
     <img src={pixelImage(selected.avatar)} alt=""/>
     <div className="dialogue-text"><small>{residentName(selected.name)}</small><p>{current.text}</p></div>
    </div>
    <div className="dialogue-controls">
     <span className="dialogue-count">{String(line+1).padStart(2,'0')} / {String(selected.messages.length).padStart(2,'0')}</span>
     {current.soundcloud?<Button className="dialogue-music" variant="ghost" title={`播放${residentName(selected.name)}在听的`} onClick={()=>musicPlayer.current?.play(current.soundcloud,{residentId:selected.user_id,name:residentName(selected.name)})}><Music2 size={15}/><span>播放{residentName(selected.name)}在听的</span></Button>:null}
     <Button className="dialogue-next" variant="outline" onClick={()=>line+1<selected.messages.length?next():setSelected(null)}>{line+1<selected.messages.length?'继续':'关闭'}<ChevronRight size={14}/></Button>
    </div>
   </>}
  </DialogContent>
 </Dialog>
 <Dialog open={editor} onOpenChange={setEditor}><DialogContent className="editor-modal"><DialogTitle className="editor-title">{editorMode==='avatar'?'（你）':'（世界）'}<small>{editorMode==='avatar'?'You':'World'}</small></DialogTitle><DialogDescription className="sr-only">选择像素画布尺寸，自由绘画</DialogDescription><ResidentEditor key={editorMode} mode={editorMode} draft={draft} onChange={next=>{if(draftReady&&authResolved&&accountReady&&next.user_id===(user?.id??''))setDraft(next);}} onSave={()=>void save()} saving={saving||positionBusy} signedIn={!!user} accountReady={draftReady&&authResolved&&accountReady} accountLoading={accountLoading} accountError={accountError} onLogin={()=>setAuth(true)} onSignOut={()=>void signOut()} onRetryAccount={()=>setAccountReload(n=>n+1)} alternatives={alternatives} onUseLocalDraft={useLocalDraft} onKeepSaved={keepSavedDraft}/></DialogContent></Dialog>
 <Dialog open={auth} onOpenChange={setAuth}><DialogContent className="auth-modal"><DialogTitle className="auth-title">登录</DialogTitle><DialogDescription className="sr-only">选择登录方式</DialogDescription><Button className="oauth" disabled={saving} onClick={()=>void login('google')}><span className="google-mark">G</span>使用 Google 登录<ArrowUpRight size={16}/></Button><Button className="oauth" disabled={saving} onClick={()=>void login('github')}><Code2 size={18}/>使用 GitHub 登录<ArrowUpRight size={16}/></Button>{!supabase&&<p className="connection-note">尚未连接 Supabase。草稿已保留。</p>}<Button className="wander" onClick={()=>setAuth(false)}>关闭</Button></DialogContent></Dialog>
 <MusicPlayer ref={musicPlayer}/>
 {notice&&<div className="notice" role="status"><span>{notice}</span>{supabase&&notice.includes('读取世界')&&<Button className="quiet" onClick={()=>void refresh()}>刷新</Button>}<Button aria-label="关闭提示" className="icon-button" onClick={()=>setNotice('')}><X size={16}/></Button></div>}
 </main>;
}
