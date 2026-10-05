'use client';
import { Plus, Trash2, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PixelEditor from '@/components/PixelEditor';
import { validateResident, type Resident, type LocalDraftAlternative } from '@/lib/world';
type EditorProps = {
 mode:'avatar'|'scenery';draft:Resident;onChange:(r:Resident)=>void;onSave:()=>void;saving:boolean;signedIn:boolean;
 accountReady:boolean;accountLoading:boolean;accountError:boolean;onLogin:()=>void;onSignOut:()=>void;onRetryAccount:()=>void;
 alternatives:LocalDraftAlternative[];onUseLocalDraft:(alternative:LocalDraftAlternative)=>void;onKeepSaved:()=>void;
};
export default function ResidentEditor({draft,onChange,onSave,saving,signedIn,mode,accountReady,accountLoading,accountError,onLogin,onSignOut,onRetryAccount,alternatives,onUseLocalDraft,onKeepSaved}:EditorProps) {
 const tab=mode;const error=validateResident(draft);
 return <div className="resident-editor"><div><PixelEditor key={tab} label={tab==='avatar'?'形象':'街景'} pixels={draft[tab]} onChange={p=>onChange({...draft,[tab]:p})}/></div><div className="editor-details">
 {mode==='avatar'&&<div className="account" style={{marginBottom:20}}>{signedIn?<><small>已登录</small><Button className="quiet" disabled={saving} onClick={onSignOut}>退出</Button></>:<Button className="quiet" disabled={saving||accountLoading} onClick={onLogin}>登录</Button>}</div>}
 {accountLoading&&<p className="connection-note" role="status">读取形象中…</p>}
 {accountError&&<div className="connection-note"><p>无法读取已保存形象，本机草稿已保留。</p><Button className="quiet" disabled={saving} onClick={onRetryAccount}>重新读取</Button></div>}
 {alternatives.length>0&&<div className="message-field"><p className="small">当前显示已保存形象。本机另有草稿；选择草稿后，点击保存才会替换形象。</p><div style={{display:'flex',flexWrap:'wrap',justifyContent:'flex-start',gap:8}}><Button className="quiet" disabled={saving} onClick={onKeepSaved}>继续已保存形象</Button>{alternatives.map(alternative=><Button className="quiet" key={alternative.kind} disabled={saving} onClick={()=>onUseLocalDraft(alternative)}>{alternatives.length===1?'使用本机草稿':alternative.kind==='anonymous'?'使用登录前草稿':'使用此账号本机草稿'}</Button>)}</div></div>}
 {mode==='avatar'&&<><label className="field">名字（可选）<input maxLength={30} placeholder="佚名" value={draft.name} onChange={e=>onChange({...draft,name:e.target.value})}/></label><div className="dialogue-heading"><span>对话</span><small>{draft.messages.length} / 15</small></div><div className="message-list">{draft.messages.map((m,i)=><div className="message-field" key={i}><div><span>对话 {String(i+1).padStart(2,'0')}</span><Button className="tool" aria-label={`删除对话 ${i+1}`} disabled={draft.messages.length===1} onClick={()=>onChange({...draft,messages:draft.messages.filter((_,n)=>n!==i)})}><Trash2 size={14}/></Button></div><textarea aria-label={`对话 ${i+1} 内容`} maxLength={500} placeholder="" value={m.text} onChange={e=>onChange({...draft,messages:draft.messages.map((v,n)=>n===i?{...v,text:e.target.value}:v)})}/><input type="url" aria-label={`对话 ${i+1} 的 SoundCloud 链接`} placeholder="SoundCloud 歌曲链接（可选）" value={m.soundcloud} onChange={e=>onChange({...draft,messages:draft.messages.map((v,n)=>n===i?{...v,soundcloud:e.target.value}:v)})}/></div>)}</div><Button className="add-message" disabled={draft.messages.length>=15} onClick={()=>onChange({...draft,messages:[...draft.messages,{text:'',soundcloud:''}]})}><Plus size={15}/>添加对话</Button></>}
 <div className="save-area"><p className="validation">{error}</p><Button className="create" disabled={!!error||saving||!accountReady} onClick={onSave}>{saving?'正在保存…':signedIn?'保存':'登录并保存'}<ArrowUpRight size={16}/></Button></div></div></div>
}
