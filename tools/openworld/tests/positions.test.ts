import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveResident, clampPosition, draggedPosition, itemPosition, positionPatch, residentPositions } from '../lib/positions.ts';
import { emptyResidentDraft } from '../lib/world.ts';

test('only the authenticated owner can move a resident',()=>{
 assert.equal(canMoveResident(null,'owner'),false);assert.equal(canMoveResident(undefined,'owner'),false);assert.equal(canMoveResident('',''),false);assert.equal(canMoveResident('visitor','owner'),false);assert.equal(canMoveResident('owner','owner'),true);
});
test('drag coordinates account for viewport dimensions and world zoom',()=>{
 assert.deepEqual(draggedPosition({x:50,y:45},100,-80,1000,800,1),{x:60,y:35});
 assert.deepEqual(draggedPosition({x:50,y:45},100,-80,1000,800,2),{x:55,y:40});
 assert.deepEqual(draggedPosition({x:50,y:45},100,-80,0,800,1),{x:50,y:45});
 assert.deepEqual(draggedPosition({x:50,y:45},Infinity,-80,1000,800,1),{x:50,y:45});
});
test('both drawings remain within the database position bounds',()=>{
 assert.deepEqual(clampPosition({x:-20,y:99}),{x:5,y:90});
 assert.deepEqual(draggedPosition({x:50,y:45},10000,-10000,1000,800,1),{x:95,y:10});
});
test('legacy scenery gets its own position and moving the avatar freezes it in place',()=>{
 const resident={...emptyResidentDraft(),user_id:'owner',x:50,y:45};
 assert.deepEqual(itemPosition(resident,'scenery'),{x:44,y:41});
 const patch=positionPatch(resident,'avatar',{x:60,y:50});assert.deepEqual(patch,{x:60,y:50,scenery_x:44,scenery_y:41});
 assert.deepEqual(itemPosition({...resident,...patch},'scenery'),{x:44,y:41});
 assert.deepEqual(positionPatch(resident,'scenery',{x:20,y:25}),{scenery_x:20,scenery_y:25});
});
test('explicit scenery positions are independent and legacy positions clamp at the edge',()=>{
 const resident={...emptyResidentDraft(),x:5,y:10,scenery_x:80,scenery_y:70};
 assert.deepEqual(residentPositions(resident),{x:5,y:10,scenery_x:80,scenery_y:70});
 assert.deepEqual(itemPosition(resident,'avatar'),{x:5,y:10});
 assert.deepEqual(itemPosition({...resident,scenery_x:null,scenery_y:null},'scenery'),{x:5,y:10});
});
