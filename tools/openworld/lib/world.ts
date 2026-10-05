export const SIZE = 50;
export type Pixels = (string | null)[];
export type Message = { text: string; soundcloud: string };
export type Resident = { user_id: string; name: string; avatar: Pixels; scenery: Pixels; messages: Message[]; x: number; y: number };
export const blank = (): Pixels => Array(SIZE * SIZE).fill(null);
export const coloredCount = (pixels: Pixels) => pixels.filter(Boolean).length;
export function validPixels(value: unknown): value is Pixels { return Array.isArray(value) && value.length === 2500 && value.every(c => c === null || (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))); }
// Keep the accepted format identical to public.valid_dialogues in Supabase.
export function soundcloudURL(value: string) { return !/\s/.test(value) && /^https:\/\/(www\.)?soundcloud\.com\/[^/?#\s]+\/[^/?#\s]+([?#][^\s]*)?$/.test(value); }
export const emptyResidentDraft = (): Resident => ({ user_id: '', name: '', avatar: blank(), scenery: blank(), messages: [{ text: '', soundcloud: '' }], x: 50, y: 45 });
export function validResidentDraft(value: unknown): value is Resident {
 if (!value || typeof value !== 'object') return false;
 const r = value as Partial<Resident>;
 return typeof r.user_id === 'string' && typeof r.name === 'string' && validPixels(r.avatar) && validPixels(r.scenery)
  && Array.isArray(r.messages) && r.messages.length >= 1 && r.messages.length <= 15
  && r.messages.every(m => !!m && typeof m === 'object' && typeof m.text === 'string' && typeof m.soundcloud === 'string')
  && typeof r.x === 'number' && Number.isFinite(r.x) && typeof r.y === 'number' && Number.isFinite(r.y);
}
export type LocalDraftAlternative = { kind: 'anonymous' | 'account'; draft: Resident };
const hasDraftContent = (r: Resident) => !!r.name.trim() || coloredCount(r.avatar) > 0 || coloredCount(r.scenery) > 0 || r.messages.some(m => !!m.text.trim() || !!m.soundcloud);
const sameDraftContent = (a: Resident, b: Resident) => JSON.stringify([a.name,a.avatar,a.scenery,a.messages]) === JSON.stringify([b.name,b.avatar,b.scenery,b.messages]);
export function resolveAccountDraft(userId: string, saved: Resident | null, anonymous: Resident | null, accountLocal: Resident | null = null) {
 if (!userId || (saved && saved.user_id !== userId)) throw new Error('形象不属于当前账号。');
 const anonymousDraft = anonymous?.user_id === '' ? anonymous : null;
 const ownLocal = accountLocal?.user_id === userId ? accountLocal : null;
 const draft = saved ?? (ownLocal && hasDraftContent(ownLocal) ? ownLocal : anonymousDraft && hasDraftContent(anonymousDraft) ? anonymousDraft : null) ?? emptyResidentDraft();
 const alternatives: LocalDraftAlternative[] = [];
 if (anonymousDraft && hasDraftContent(anonymousDraft) && draft !== anonymousDraft && !sameDraftContent(draft, anonymousDraft)) alternatives.push({kind:'anonymous',draft:anonymousDraft});
 if (saved && ownLocal && hasDraftContent(ownLocal) && !sameDraftContent(saved, ownLocal) && !alternatives.some(a => sameDraftContent(a.draft,ownLocal))) alternatives.push({kind:'account',draft:ownLocal});
 return { draft: { ...draft, user_id: userId }, alternatives, adoptedAnonymous: !saved && draft === anonymousDraft };
}
export function validateResident(r: Resident) {
 if (r.name.length > 30) return '名字最多 30 字。';
 if (!validPixels(r.avatar) || !validPixels(r.scenery)) return '画布必须是 50×50 像素。';
 if (coloredCount(r.avatar) < 10) return '请为自己画上至少 10 个有色像素。';
 if (coloredCount(r.scenery) > 0 && coloredCount(r.scenery) < 10) return '街景请至少画 10 个有色像素，或保持空白。';
 if (r.messages.length < 1 || r.messages.length > 15 || r.messages.some(m => !m.text.trim() || m.text.length > 500)) return '请设置 1–15 条对话，每条 1–500 字。';
 if (r.messages.some(m => m.soundcloud && !soundcloudURL(m.soundcloud))) return '音乐请填写有效的 https://soundcloud.com/艺人/歌曲 链接。';
 return null;
}
export function pixelSVG(p: Pixels) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" shape-rendering="crispEdges">${p.map((c,i) => c ? `<rect x="${i%50}" y="${Math.floor(i/50)}" width="1" height="1" fill="${c}"/>` : '').join('')}</svg>`; }
export function pixelImage(p: Pixels) { return `data:image/svg+xml,${encodeURIComponent(pixelSVG(p))}`; }
function illustration(kind: number, color: string): Pixels {
 const p=blank(); const box=(x:number,y:number,w:number,h:number,c:string)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&i<50&&j>=0&&j<50)p[j*50+i]=c;};
 const ink='#47483d', skin='#e7bf93';
 if(kind===3){box(20,29,14,12,color);box(17,21,20,12,color);box(17,16,5,7,color);box(32,16,5,7,color);box(20,19,2,3,skin);box(33,19,2,3,skin);box(22,26,2,2,ink);box(31,26,2,2,ink);box(26,30,2,2,ink);box(34,35,7,3,color);box(39,30,3,7,color);box(19,39,4,4,ink);box(30,39,4,4,ink);return p;}
 box(21,12,12,12,skin);box(20,10,14,5,ink);box(20,15,3,6,ink);box(24,18,2,2,ink);box(30,18,2,2,ink);box(19,25,17,12,color);box(16,26,3,9,skin);box(36,26,3,9,skin);box(21,37,5,8,ink);box(30,37,5,8,ink);box(19,43,7,3,ink);box(30,43,7,3,ink);
 if(kind===1){box(16,8,22,4,color);box(22,4,11,6,color);box(40,21,2,23,ink);box(38,20,6,3,'#a2a476');}if(kind===2){box(23,30,9,5,'#f7efdb');box(25,27,5,3,'#f7efdb');}return p;
}
function scenery(kind:number):Pixels {const p=blank();const set=(x:number,y:number,c:string)=>{if(x>=0&&x<50&&y>=0&&y<50)p[y*50+x]=c;};if(kind===0){for(let y=12;y<39;y++)for(let x=13;x<37;x++){if(((x-25)/12)**2+((y-24)/13)**2<1)set(x,y,(x+y)%3?'#8c9c77':'#b0b893');}for(let y=34;y<49;y++)for(let x=24;x<27;x++)set(x,y,'#89725c');}else{for(let x=8;x<44;x++)for(let y=25;y<30;y++)set(x,y,'#b29a7b');for(let x=8;x<44;x++)set(x,33,'#89725c');for(let y=28;y<44;y++){set(12,y,'#89725c');set(39,y,'#89725c');}}return p;}
export const examples: Resident[] = [
 {user_id:'demo-1',name:'阿树',avatar:illustration(1,'#899775'),scenery:scenery(0),x:30,y:43,messages:[{text:'风吹到这里，就慢下来了。\n要不要一起坐一会儿？',soundcloud:''},{text:'我想把每一个普通的下午，\n都画成自己喜欢的样子。',soundcloud:''}]},
 {user_id:'demo-2',name:'小满',avatar:illustration(2,'#bd8069'),scenery:scenery(1),x:62,y:56,messages:[{text:'你好，路过的人。\n今天也没有什么大事，只有一杯热茶。',soundcloud:''},{text:'如果你愿意，也可以在这里画一个自己。',soundcloud:''}]},
 {user_id:'demo-3',name:'一只猫',avatar:illustration(3,'#b7a488'),scenery:blank(),x:46,y:68,messages:[{text:'喵。\n（它给你留了一小块晒太阳的位置。）',soundcloud:''}]},
 {user_id:'demo-4',name:'远山',avatar:illustration(0,'#8499a3'),scenery:scenery(0),x:77,y:32,messages:[{text:'这里没有目的地。\n走到哪里，哪里就是世界。',soundcloud:''}]}
];
