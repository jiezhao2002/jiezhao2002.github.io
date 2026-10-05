'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Pencil, Eraser, Undo2, Redo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANVAS_SIZES, canvasSize, resizePixels, coloredCount, type Pixels } from '@/lib/world';

export default function PixelEditor({pixels,onChange,label}:{pixels:Pixels;onChange:(p:Pixels)=>void;label:string}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const current=useRef(pixels);
 const drawing=useRef(false);
 const last=useRef<[number,number]|null>(null);
 const history=useRef<Pixels[]>([]);
 const redo=useRef<Pixels[]>([]);
 const [color,setColor]=useState('#667b56');
 const [erase,setErase]=useState(false);
 const [grid,setGrid]=useState(true);
 const [,setTick]=useState(0);
 const [hue,setHue]=useState(95);
 const [light,setLight]=useState(42);
 const [zoom,setZoom]=useState(1);
 const [cursor,setCursor]=useState<[number,number]>([25,25]);
 const size=canvasSize(pixels);
 const unit=8;

 useEffect(()=>{
  current.current=pixels;
  const ctx=canvas.current?.getContext('2d');
  if(!ctx)return;
  ctx.clearRect(0,0,size*unit,size*unit);
  pixels.forEach((c,i)=>{if(c){ctx.fillStyle=c;ctx.fillRect((i%size)*unit,Math.floor(i/size)*unit,unit,unit);}});
  if(grid){
   ctx.strokeStyle='#626e5618';ctx.lineWidth=1;
   for(let i=0;i<=size;i++){
    ctx.beginPath();ctx.moveTo(i*unit,0);ctx.lineTo(i*unit,size*unit);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*unit);ctx.lineTo(size*unit,i*unit);ctx.stroke();
   }
  }
 },[pixels,grid,size]);
 useEffect(()=>{
  setCursor(([x,y])=>[Math.min(size-1,x),Math.min(size-1,y)]);
  drawing.current=false;last.current=null;
 },[size]);
 const apply=(next:Pixels)=>{current.current=next;onChange(next);};
 const commitHistory=()=>{history.current=[...history.current.slice(-39),[...current.current]];redo.current=[];setTick(v=>v+1);};
 const point=(e:PointerEvent<HTMLCanvasElement>):[number,number]=>{
  const r=e.currentTarget.getBoundingClientRect();
  const currentSize=canvasSize(current.current);
  return [Math.max(0,Math.min(currentSize-1,Math.floor((e.clientX-r.left)/r.width*currentSize))),Math.max(0,Math.min(currentSize-1,Math.floor((e.clientY-r.top)/r.height*currentSize)))];
 };
 const paint=(pos:[number,number])=>{
  const next=[...current.current];const currentSize=canvasSize(next);const start=last.current??pos;
  const dx=pos[0]-start[0],dy=pos[1]-start[1],steps=Math.max(Math.abs(dx),Math.abs(dy));
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;next[Math.round(start[1]+dy*t)*currentSize+Math.round(start[0]+dx*t)]=erase?null:color;}
  last.current=pos;apply(next);setCursor(pos);
 };
 const undo=()=>{const prev=history.current.pop();if(prev){redo.current.push([...current.current]);apply(prev);setTick(v=>v+1);}};
 const hsl=(h:number,l:number)=>{const a=.65*Math.min(l/100,1-l/100);const channel=(n:number)=>{const k=(n+h/30)%12;return Math.round(255*(l/100-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return `#${channel(0)}${channel(8)}${channel(4)}`;};
 const stopDrawing=()=>{drawing.current=false;last.current=null;};

 return <div className="pixel-editor">
  <div className="canvas-heading"><span>{label}</span><span>{size} × {size} <span className="muted">/ {coloredCount(pixels)} 有色像素</span></span></div>
  <div className="canvas-settings">
   <label>画布大小<select aria-label={`${label}画布大小`} value={size} onChange={e=>{commitHistory();apply(resizePixels(current.current,Number(e.target.value)));}}>{CANVAS_SIZES.map(value=><option key={value} value={value}>{value} × {value}</option>)}</select></label>
   <label>缩放<input aria-label={`${label}画布缩放`} type="range" min={1} max={4} step={.25} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><output>{Math.round(zoom*100)}%</output></label>
  </div>
  <div className="drawing-viewport">
   <canvas ref={canvas} width={size*unit} height={size*unit} tabIndex={0} role="img" aria-label={`${label}绘画画布，${size} × ${size} 像素，方向键移动，空格绘制。当前 ${cursor[0]+1}, ${cursor[1]+1}`} className="drawing-canvas" style={{width:`${zoom*100}%`}}
    onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;last.current=null;commitHistory();paint(point(e));}}
    onPointerMove={e=>{if(drawing.current)paint(point(e));}} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onLostPointerCapture={stopDrawing}
    onKeyDown={e=>{let [x,y]=cursor;if(e.key==='ArrowLeft')x--;else if(e.key==='ArrowRight')x++;else if(e.key==='ArrowUp')y--;else if(e.key==='ArrowDown')y++;else if(e.key===' '){e.preventDefault();commitHistory();last.current=null;paint(cursor);last.current=null;return;}else return;e.preventDefault();setCursor([Math.max(0,Math.min(size-1,x)),Math.max(0,Math.min(size-1,y))]);}}/>
  </div>
  <div className="editor-toolbar"><Button className={`tool ${!erase?'active':''}`} aria-label="铅笔" aria-pressed={!erase} onClick={()=>setErase(false)}><Pencil/></Button><Button className={`tool ${erase?'active':''}`} aria-label="橡皮" aria-pressed={erase} onClick={()=>setErase(true)}><Eraser/></Button><div className="divider"/><Button className="tool" aria-label="撤销" disabled={!history.current.length} onClick={undo}><Undo2/></Button><Button className="tool" aria-label="重做" disabled={!redo.current.length} onClick={()=>{const next=redo.current.pop();if(next){history.current.push([...current.current]);apply(next);setTick(v=>v+1);}}}><Redo2/></Button><Button className="tool" aria-label="清空画布，可撤销" onClick={()=>{commitHistory();apply(Array(current.current.length).fill(null));}}><Trash2/></Button><label className="grid-toggle"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>网格</label></div>
  <div className="color-tools"><div className="color-wheel" role="slider" tabIndex={0} aria-label="色轮" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hue)} onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();const h=(Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI+450)%360;setHue(h);setColor(hsl(h,light));setErase(false);}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const h=(hue+(e.key==='ArrowRight'?5:-5)+360)%360;setHue(h);setColor(hsl(h,light));}}><span style={{background:color}}/></div><div className="palette"><div className="swatches">{['#41473d','#667b56','#a7b590','#ceba94','#bd8069','#819aa6','#e6d0b3','#f9f5e9'].map(c=><button key={c} style={{background:c}} aria-label={`选择颜色 ${c}`} className={color===c?'chosen':''} onClick={()=>{setColor(c);setErase(false);}}/>)}</div><label className="lightness">明度<input type="range" min={5} max={95} value={light} onChange={e=>{const l=+e.target.value;setLight(l);setColor(hsl(hue,l));}}/></label><label className="custom-color"><input type="color" value={color} onChange={e=>{setColor(e.target.value);setErase(false);}}/>{color}</label></div></div>
 </div>;
}
