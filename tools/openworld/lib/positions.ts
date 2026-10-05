import type { Resident } from './world';

export type WorldItem = 'avatar' | 'scenery';
export type Position = { x: number; y: number };
export type ResidentPositions = { x: number; y: number; scenery_x: number; scenery_y: number };
export type PositionPatch = Partial<ResidentPositions>;

export const canMoveResident = (ownerId: string | null | undefined, residentId: string) => !!ownerId && ownerId === residentId;
export const clampPosition = ({x, y}: Position): Position => ({x: Math.min(95, Math.max(5, x)), y: Math.min(90, Math.max(10, y))});
export function residentPositions(resident: Pick<Resident, 'x' | 'y' | 'scenery_x' | 'scenery_y'>): ResidentPositions {
 const scenery = clampPosition({x: resident.scenery_x ?? resident.x - 6, y: resident.scenery_y ?? resident.y - 4});
 return {x:resident.x, y:resident.y, scenery_x:scenery.x, scenery_y:scenery.y};
}
export function itemPosition(resident: Resident, item: WorldItem): Position {
 const positions = residentPositions(resident);
 return item === 'avatar' ? {x:positions.x,y:positions.y} : {x:positions.scenery_x,y:positions.scenery_y};
}
export function draggedPosition(origin: Position, dx: number, dy: number, width: number, height: number, zoom: number): Position {
 if (![dx,dy,width,height,zoom].every(Number.isFinite) || width <= 0 || height <= 0 || zoom <= 0) return clampPosition(origin);
 return clampPosition({x:origin.x + dx / width / zoom * 100, y:origin.y + dy / height / zoom * 100});
}
export function positionPatch(resident: Resident, item: WorldItem, position: Position): PositionPatch {
 const next = clampPosition(position);
 // Fix the legacy scenery position before moving the avatar, so both drawings move independently.
 const current = residentPositions(resident);
 return item === 'avatar' ? {...current,...next} : {scenery_x:next.x,scenery_y:next.y};
}
