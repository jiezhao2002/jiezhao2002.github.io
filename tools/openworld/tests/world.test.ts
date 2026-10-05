import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, validPixels, validateResident, pixelSVG, soundcloudURL, emptyResidentDraft, validResidentDraft, resolveAccountDraft, canvasSize, resizePixels, CANVAS_SIZES, type Resident } from '../lib/world.ts';
const sample=():Resident=>({user_id:'test',name:'朋友',avatar:blank().map((c,i)=>i<10?'#667b56':c),scenery:blank(),messages:[{text:'你好',soundcloud:''}],x:50,y:50});
test('transparent 50×50 canvas and safe SVG',()=>{assert.equal(blank().length,2500);assert.ok(blank().every(p=>p===null));assert.equal(validPixels(['#667b56']),false);const bad=blank();bad[0]='<script>';assert.equal(validPixels(bad),false);assert.equal((pixelSVG(sample().avatar).match(/<rect/g)||[]).length,10);assert.ok(!pixelSVG(blank()).includes('<rect'));});
test('requires 10 colored pixels, 1–15 nonempty dialogues, optional scenery',()=>{const r=sample();r.name='';assert.equal(validateResident(r),null);r.avatar[0]=null;assert.ok(validateResident(r));r.avatar[0]='#667b56';r.messages=[];assert.ok(validateResident(r));r.messages=Array.from({length:16},()=>({text:'你好',soundcloud:''}));assert.ok(validateResident(r));r.messages=[{text:' ',soundcloud:''}];assert.ok(validateResident(r));r.messages=[{text:'你好',soundcloud:''}];r.scenery[0]='#667b56';assert.ok(validateResident(r));});
test('SoundCloud accepts the same two-segment HTTPS track format as Supabase',()=>{
 for(const url of ['https://soundcloud.com/artist/track','https://www.soundcloud.com/artist/track?si=123#comment'])assert.ok(soundcloudURL(url));
 for(const url of ['javascript:alert(1)','https://soundcloud.com.evil.test/a/b','http://soundcloud.com/a/b','https://soundcloud.com/artist','https://soundcloud.com/artist/sets/playlist','https://soundcloud.com:443/a/b','https://user@soundcloud.com/a/b','https://soundcloud.com/a/b/','https://soundcloud.com/a/b?bad=white space','https://soundcloud.com/a/b\n'])assert.equal(soundcloudURL(url),false,url);
});
test('existing account starts with its saved resident and preserves anonymous draft as an explicit alternative',()=>{
 const saved=sample();const anonymous={...sample(),user_id:'',name:'未发布'};
 const resolved=resolveAccountDraft('test',saved,anonymous);
 assert.deepEqual(resolved.draft,saved);assert.equal(resolved.adoptedAnonymous,false);
 assert.equal(resolved.alternatives.length,1);assert.equal(resolved.alternatives[0].kind,'anonymous');assert.deepEqual(resolved.alternatives[0].draft,anonymous);
 assert.equal(anonymous.user_id,'');
});
test('new account resumes anonymous drawing under its own ID, never another account draft',()=>{
 const anonymous={...sample(),user_id:''};const resolved=resolveAccountDraft('new-user',null,anonymous,sample());
 assert.equal(resolved.draft.user_id,'new-user');assert.deepEqual(resolved.draft.avatar,anonymous.avatar);assert.equal(resolved.adoptedAnonymous,true);
 assert.equal(anonymous.user_id,'');assert.deepEqual(resolved.alternatives,[]);
 assert.equal(resolveAccountDraft('new-user',null,sample(),sample()).draft.name,'');
 assert.throws(()=>resolveAccountDraft('new-user',sample(),anonymous));
});
test('empty or duplicate anonymous canvas does not prompt; own local draft remains a separate choice',()=>{
 const saved=sample();assert.deepEqual(resolveAccountDraft('test',saved,emptyResidentDraft()).alternatives,[]);
 assert.deepEqual(resolveAccountDraft('test',saved,{...saved,user_id:''}).alternatives,[]);
 const local={...saved,name:'还没保存'};const resolved=resolveAccountDraft('test',saved,emptyResidentDraft(),local);
 assert.equal(resolved.draft.name,saved.name);assert.equal(resolved.alternatives[0].kind,'account');assert.equal(resolved.alternatives[0].draft.name,'还没保存');
});
test('a returning unpublished account keeps its later edits and offers the earlier anonymous drawing',()=>{
 const anonymous={...sample(),user_id:'',name:'登录前'};const local={...sample(),name:'登录后修改'};
 const resolved=resolveAccountDraft('test',null,anonymous,local);
 assert.equal(resolved.draft.name,'登录后修改');assert.equal(resolved.draft.user_id,'test');assert.equal(resolved.adoptedAnonymous,false);
 assert.equal(resolved.alternatives.length,1);assert.equal(resolved.alternatives[0].draft.name,'登录前');
});
test('stored drafts require ownership, safe pixels, dialogue shape and finite positions',()=>{
 assert.ok(validResidentDraft(emptyResidentDraft()));assert.ok(validResidentDraft(sample()));
 for(const value of [{...sample(),user_id:undefined},{...sample(),x:NaN},{...sample(),y:Infinity},{...sample(),scenery_x:NaN},{...sample(),scenery_y:'30'},{...sample(),messages:[null]},{...sample(),messages:[{text:1,soundcloud:''}]}])assert.equal(validResidentDraft(value),false);
});
test('all selectable canvas resolutions validate and render their actual pixel coordinates',()=>{
 for(const size of CANVAS_SIZES){const pixels=blank(size);pixels[size*size-1]='#123456';assert.equal(validPixels(pixels),true);assert.equal(canvasSize(pixels),size);const svg=pixelSVG(pixels);assert.ok(svg.includes(`viewBox="0 0 ${size} ${size}"`));assert.ok(svg.includes(`<rect x="${size-1}" y="${size-1}"`));const r={...sample(),avatar:blank(size).map((pixel,i)=>i<10?'#123456':pixel),scenery:blank(size)};assert.equal(validateResident(r),null);assert.equal(validResidentDraft(r),true);}
 assert.equal(validPixels(blank(75)),false);assert.equal(validPixels(blank(201)),false);
});
test('canvas resizing preserves proportion and transparent areas with nearest-neighbor sampling',()=>{
 const pixels=blank();pixels[0]='#123456';pixels[2499]='#abcdef';const larger=resizePixels(pixels,100);
 assert.equal(larger.length,10000);assert.equal(larger[0],'#123456');assert.equal(larger[1],'#123456');assert.equal(larger[100],'#123456');assert.equal(larger[101],'#123456');assert.equal(larger[2],null);assert.equal(larger[9999],'#abcdef');assert.deepEqual(resizePixels(larger,50),pixels);
 assert.throws(()=>resizePixels(pixels,75));assert.deepEqual(resizePixels(pixels,50),pixels);assert.notEqual(resizePixels(pixels,50),pixels);
});
