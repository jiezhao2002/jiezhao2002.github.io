'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { coloredCount, pixelImage, residentName, type Resident } from '@/lib/world';
import { canMoveResident, draggedPosition, itemPosition, positionPatch, type Position, type PositionPatch, type WorldItem } from '@/lib/positions';
import './WorldCanvas.css';

type Props = {
 residents: Resident[];
 ownerId: string | null;
 moving: boolean;
 loading: boolean;
 zoom: number;
 pan: Position;
 onPan: (pan: Position) => void;
 onOpen: (resident: Resident) => void;
 onMove: (resident: Resident, patch: PositionPatch) => void;
};
type ItemDrag = { resident: Resident; item: WorldItem; pointerId: number; start: Position; origin: Position; position: Position; moved: boolean; width: number; height: number; zoom: number };
export default function WorldCanvas({residents,ownerId,moving,loading,zoom,pan,onPan,onOpen,onMove}: Props) {
 const world = useRef<HTMLElement>(null);
 const itemDrag = useRef<ItemDrag | null>(null);
 const blankDrag = useRef<{start:Position;origin:Position} | null>(null);
 const suppressClick = useRef<string | null>(null);
 const [preview,setPreview] = useState<{id:string;item:WorldItem;position:Position} | null>(null);
 useEffect(() => { itemDrag.current=null;setPreview(null);suppressClick.current=null; }, [ownerId]);
 const key = (resident: Resident,item: WorldItem) => `${resident.user_id}:${item}`;
 const begin = (event: PointerEvent<HTMLButtonElement>,resident: Resident,item: WorldItem) => {
  if (event.button !== 0 || moving || !canMoveResident(ownerId,resident.user_id) || !world.current) return;
  event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  suppressClick.current=null;
  const box=world.current.getBoundingClientRect();const origin=itemPosition(resident,item);
  itemDrag.current={resident,item,pointerId:event.pointerId,start:{x:event.clientX,y:event.clientY},origin,position:origin,moved:false,width:box.width,height:box.height,zoom};
 };
 const move = (event: PointerEvent<HTMLButtonElement>) => {
  const gesture=itemDrag.current;if(!gesture || event.pointerId!==gesture.pointerId)return;
  const dx=event.clientX-gesture.start.x,dy=event.clientY-gesture.start.y;
  if(!gesture.moved && Math.hypot(dx,dy)<5)return;
  gesture.moved=true;gesture.position=draggedPosition(gesture.origin,dx,dy,gesture.width,gesture.height,gesture.zoom);
  setPreview({id:gesture.resident.user_id,item:gesture.item,position:gesture.position});
 };
 const finish = (event: PointerEvent<HTMLButtonElement>,cancelled=false) => {
  const gesture=itemDrag.current;if(!gesture || gesture.pointerId!==event.pointerId)return;
  itemDrag.current=null;setPreview(null);
  if(gesture.moved){suppressClick.current=key(gesture.resident,gesture.item);if(!cancelled && canMoveResident(ownerId,gesture.resident.user_id))onMove(gesture.resident,positionPatch(gesture.resident,gesture.item,gesture.position));}
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const drawing = (resident: Resident,item: WorldItem) => {
  const own=canMoveResident(ownerId,resident.user_id);const position=preview?.id===resident.user_id&&preview.item===item?preview.position:itemPosition(resident,item);
  return <button key={key(resident,item)} className={`world-drawing world-${item}${own?' world-own':''}${preview?.id===resident.user_id&&preview.item===item?' world-dragging':''}`} style={{left:`${position.x}%`,top:`${position.y}%`}} aria-label={item==='avatar'?residentName(resident.name):`${residentName(resident.name)}的街景`} title={own?'拖动改变位置':'点击对话'} onPointerDown={event=>begin(event,resident,item)} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)} onKeyDown={event=>{
   if(!own || moving || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();const step=event.shiftKey?5:1;
   onMove(resident,positionPatch(resident,item,{x:position.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),y:position.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)}));
  }} onClick={()=>{if(suppressClick.current===key(resident,item)){suppressClick.current=null;return;}onOpen(resident);}}><img src={pixelImage(item==='avatar'?resident.avatar:resident.scenery)} alt="" draggable={false}/>{item==='avatar'&&<span>{residentName(resident.name)}</span>}</button>;
 };
 return <section ref={world} className="world" aria-label="自由世界，拖动空白处漫游" onPointerDown={event=>{
  if(event.button!==0 || (event.target as HTMLElement).closest('button'))return;
  event.currentTarget.setPointerCapture(event.pointerId);blankDrag.current={start:{x:event.clientX,y:event.clientY},origin:pan};
 }} onPointerMove={event=>{const gesture=blankDrag.current;if(gesture)onPan({x:gesture.origin.x+event.clientX-gesture.start.x,y:gesture.origin.y+event.clientY-gesture.start.y});}} onPointerUp={()=>{blankDrag.current=null;}} onPointerCancel={()=>{blankDrag.current=null;}} onLostPointerCapture={()=>{blankDrag.current=null;}}>
  <div className="world-content" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>{residents.map(resident=>coloredCount(resident.scenery)>0?drawing(resident,'scenery'):null)}{residents.map(resident=>drawing(resident,'avatar'))}</div>
  {loading&&<span className="sr-only" role="status">加载中</span>}
 </section>;
}
