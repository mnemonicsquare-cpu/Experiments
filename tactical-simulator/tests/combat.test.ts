import {describe,it,expect} from 'vitest';
import {DEFAULT_LOADOUT,WEAPONS} from '../src/data/definitions';
import {MAPS} from '../src/data/maps';
import {actor,alive,applyHazards,area,createBattle,coverValue,effectiveArmour,endActivation,execute,forecast,invalid,legalCommands,maxActions,rawDamage,restore,serialize,setStatus,startActivation,undo,wound} from '../src/engine/combat';
import {probability,roll} from '../src/engine/random';
import {aiStep,refreshIntents} from '../src/engine/ai';
import type {Battle,Command,Status} from '../src/engine/types';

function fixture(primary='rifle',armour='carapace'){
  const s=createBattle('terminal',17,{...DEFAULT_LOADOUT,primary,armour,utility:'harness'});const h=s.units[0],e=s.units[1];
  h.area='z1_1';e.area='z2_1';s.units[2].area='z6_1';return {s,h,e};
}
const dice=(s:Battle,...values:number[])=>{s.forcedDice=values;};
const shot=(target='enemy0',weapon='rifle'):Command=>({type:'SHOOT',weapon,target});
const next=(s:Battle)=>{const round=s.round;while(!s.outcome&&s.round===round)endActivation(s);};

describe('2d6 and replay',()=>{
  it('enumerates exact curves and natural endpoints',()=>{expect(probability(1)).toBe(26/36);expect(probability(0)).toBe(21/36);expect(probability(-1)).toBe(15/36);expect(probability(-2)).toBe(10/36);expect(probability(-3)).toBe(6/36);expect(probability(-4)).toBe(3/36);expect(probability(-5)).toBe(1/36);expect(probability(100)).toBe(35/36);});
  it('serializes the complete seeded RNG stream',()=>{const {s}=fixture();roll(s);const clone=restore(serialize(s))!;expect(Array.from({length:200},()=>roll(s))).toEqual(Array.from({length:200},()=>roll(clone)));});
  it('intent generation never changes RNG',()=>{const {s}=fixture();const before=s.rng;refreshIntents(s);expect(s.rng).toBe(before);});
  it('rejects malformed saves',()=>{expect(restore('{}')).toBeUndefined();expect(restore('bad')).toBeUndefined();});
});
describe('action economy',()=>{
  it('each type once; movement and rush separately',()=>{const {s,h}=fixture();expect(execute(s,{type:'MOVE',area:'z0_1'}).ok).toBe(true);expect(execute(s,{type:'MOVE',area:'z1_1'}).ok).toBe(false);expect(execute(s,{type:'RUSH',area:'z1_1'}).ok).toBe(true);expect(h.ap).toBe(1);});
  it('heavy ranged costs two but one Shoot use',()=>{const {s,h}=fixture('repeater');dice(s,1,1);execute(s,shot('enemy0','repeater'));expect(h.ap).toBe(1);expect(h.used).toEqual(['SHOOT']);expect(execute(s,shot()).ok).toBe(false);});
  it('heavy melee costs two for charge and attack',()=>{const {s,h,e}=fixture();h.loadout.melee='hammer';dice(s,1,1,1,1);execute(s,{type:'CHARGE',target:e.id});expect(h.ap).toBe(1);expect(execute(s,{type:'MELEE',target:e.id}).ok).toBe(false);});
  it('wounds reduce actions by worst location, not sum',()=>{const {h}=fixture();h.wounds.ARM=1;h.wounds.LEG=1;expect(maxActions(h)).toBe(2);h.wounds.HEAD=2;expect(maxActions(h)).toBe(1);});
  it('plate minimum one, servo removes bulky AP penalty',()=>{const {h}=fixture('rifle','plate');expect(maxActions(h)).toBe(2);h.wounds.HEAD=2;expect(maxActions(h)).toBe(1);h.loadout.armour='powered';h.wounds.HEAD=0;expect(maxActions(h)).toBe(3);});
  it('hard disables override the minimum',()=>{const {s,h}=fixture();setStatus(s,h,'STUNNED',1);expect(maxActions(h)).toBe(0);delete h.statuses.STUNNED;h.wounds.HEAD=1;setStatus(s,h,'ENTANGLED');expect(maxActions(h)).toBe(0);});
  it('mid-activation wound clamps remaining actions',()=>{const {s,h}=fixture();execute(s,{type:'AIM'});wound(s,h,4,false,'ARM');expect(h.ap).toBe(0);});
});
describe('cover, height and aiming',()=>{
  it('cover is directional, inactive in same zone',()=>{const {s,h,e}=fixture();e.cover='LEFT';expect(coverValue(s,e,h)).toBe(1);e.cover='RIGHT';expect(coverValue(s,e,h)).toBe(0);h.area='z2_0';e.cover='LEFT';expect(coverValue(s,e,h)).toBe(0);});
  it('light cover contributes exactly minus two',()=>{const {s,h,e}=fixture();e.cover='LEFT';expect(forecast(s,h,e,shot()).modifiers.find(x=>x.label==='Лёгкое укрытие')?.value).toBe(-2);});
  it('heavy cover forbids direct fire but ignore cover bypasses it',()=>{const {s,h,e}=fixture('shotgun');h.area='z2_1';e.area='z3_1';e.cover='LEFT';expect(invalid(s,h,shot('enemy0','pistol'))).toMatch(/тяжёл/);expect(invalid(s,h,shot('enemy0','shotgun'))).toBeUndefined();});
  it('ordinary action removes cover; interaction and grenade retain it',()=>{const {s,h}=fixture();h.area='z2_1';h.cover='RIGHT';execute(s,{type:'AIM'});expect(h.cover).toBeUndefined();h.cover='RIGHT';dice(s,4,4,1,1);execute(s,{type:'SHOOT',weapon:'grenade',grenade:'smoke',area:'z3_1'});expect(h.cover).toBe('RIGHT');});
  it('interactive operation preserves stationary cover',()=>{const s=createBattle('toxic');const h=s.units[0];h.cover='RIGHT';expect(execute(s,{type:'INTERACT',interaction:'vent'}).ok).toBe(true);expect(h.cover).toBe('RIGHT');});
  it('cover cannot be used twice after shooting out of it',()=>{const {s,h}=fixture();h.area='z0_1';execute(s,{type:'COVER',direction:'RIGHT'});dice(s,1,1);execute(s,shot());expect(h.cover).toBeUndefined();expect(execute(s,{type:'COVER',direction:'RIGHT'}).ok).toBe(false);});
  it.each([['rifle',4],['sniper',6],['shotgun',1],['flame',1],['grenade',2]])('%s height range is %s',(weapon,range)=>{const {s,h,e}=fixture(weapon);h.area='z2_2';e.area='z4_1';const f=forecast(s,h,e,shot(e.id,weapon));expect(f.range).toBe(range);expect(f.modifiers.find(x=>x.label==='Высота')?.value).toBe(1);});
  it('all height benefits cancel against another elevated area',()=>{const {s,h,e}=fixture('sniper');h.area='z2_2';e.area='z4_2';const f=forecast(s,h,e,shot(e.id,'sniper'));expect(f.range).toBe(4);expect(f.modifiers.some(x=>x.label==='Высота')).toBe(false);});
  it('aim survives turn boundaries and ordinary damage',()=>{const {s,h}=fixture();execute(s,{type:'AIM'});rawDamage(s,h,1);next(s);expect(h.aim).toBe(true);});
  it('aim cancels on another own action, stunned or knockdown',()=>{const {s,h}=fixture();execute(s,{type:'AIM'});execute(s,{type:'MOVE',area:'z0_1'});expect(h.aim).toBe(false);h.aim=true;setStatus(s,h,'KNOCKED_DOWN');expect(h.aim).toBe(false);h.aim=true;setStatus(s,h,'STUNNED',1);expect(h.aim).toBe(false);});
  it('grenade uses Shoot, keeps cover and consumes aim',()=>{const {s,h}=fixture();h.cover='RIGHT';h.aim=true;dice(s,6,6,1,1);execute(s,{type:'SHOOT',weapon:'grenade',grenade:'frag',area:'z2_1'});expect(h.cover).toBe('RIGHT');expect(h.aim).toBe(false);expect(h.used).toContain('SHOOT');expect(execute(s,shot()).ok).toBe(false);});
});
describe('physical movement and melee',()=>{
  it('cannot move into an enemy area or teleport across floors',()=>{const {s,h}=fixture();expect(invalid(s,h,{type:'MOVE',area:'z2_1'})).toBeDefined();expect(invalid(s,h,{type:'MOVE',area:'z2_2'})).toBeDefined();});
  it('charge attacks and permits separate melee action; reactions cost no AP',()=>{const {s,h,e}=fixture();const before=e.ap;dice(s,1,1,1,1,1,1,1,1);execute(s,{type:'CHARGE',target:e.id});expect(h.area).toBe(e.area);expect(h.used).not.toContain('MELEE');expect(e.ap).toBe(before);expect(e.used).toEqual([]);execute(s,{type:'MELEE',target:e.id});expect(s.stats.enemy.attacks).toBe(2);});
  it('all defenders counter charge, no recursive reactions',()=>{const {s,h,e}=fixture();s.units[2].area=e.area;dice(s,...Array(20).fill(1));execute(s,{type:'CHARGE',target:e.id});expect(s.stats.player.attacks).toBe(1);expect(s.stats.enemy.attacks).toBe(2);expect(h.ap).toBe(2);});
  it('incapacitated primary defender does not counter; allies do',()=>{const {s,e}=fixture();s.units[2].area=e.area;e.hp=1;e.loadout.armour='none';dice(s,4,4,1,1);execute(s,{type:'CHARGE',target:e.id});expect(e.hp).toBe(0);expect(s.stats.enemy.attacks).toBe(1);});
  it('regular melee only provokes the direct target',()=>{const {s,h,e}=fixture();h.area=e.area;s.units[2].area=e.area;dice(s,...Array(20).fill(1));execute(s,{type:'MELEE',target:e.id});expect(s.stats.enemy.attacks).toBe(1);});
  it('free heavy counterattack costs zero',()=>{const {s,h,e}=fixture();h.area=e.area;e.loadout.melee='hammer';e.ap=0;dice(s,1,1,1,1);execute(s,{type:'MELEE',target:e.id});expect(s.stats.enemy.attacks).toBe(1);expect(e.ap).toBe(0);});
  it('retreat has no reaction; ordinary move is blocked in melee',()=>{const {s,h,e}=fixture();h.area=e.area;expect(invalid(s,h,{type:'MOVE',area:'z1_1'})).toBeDefined();expect(execute(s,{type:'RETREAT',area:'z1_1'}).ok).toBe(true);expect(s.stats.enemy.attacks).toBe(0);});
  it('climb and descend require an actual ladder',()=>{const {s,h,e}=fixture();e.area='z6_1';h.area='z4_1';expect(execute(s,{type:'CLIMB',area:'z4_2'}).ok).toBe(true);expect(execute(s,{type:'DESCEND',area:'z4_1'}).ok).toBe(true);});
  it('charge onto occupied elevation requires climb plus charge',()=>{const {s,h,e}=fixture();h.area='z4_1';e.area='z4_2';h.loadout.melee='hammer';expect(invalid(s,h,{type:'CHARGE',target:e.id})).toBeDefined();execute(s,{type:'CLIMB',area:e.area});expect(h.area).toBe('z4_1');dice(s,1,1,1,1);expect(execute(s,{type:'CHARGE',target:e.id}).ok).toBe(true);expect(h.area).toBe('z4_2');expect(h.ap).toBe(0);});
  it('perfect jump refunds AP but not action type',()=>{const {s,h}=fixture();h.area='z2_2';s.units[1].area='z5_1';dice(s,6,6);execute(s,{type:'JUMP',area:'z2_1'});expect(h.ap).toBe(3);expect(h.used).toContain('JUMP');});
  it('failed jump ignores absorption and injures leg',()=>{const {s,h}=fixture('rifle','plate');h.area='z2_2';s.units[1].area='z5_1';dice(s,1,1);execute(s,{type:'JUMP',area:'z2_1'});expect(h.hp).toBe(6);expect(h.wounds.LEG).toBe(1);});
  it('capacity is three per side',()=>{const {s,h}=fixture();for(let i=0;i<3;i++)s.units.push({...structuredClone(h),id:`ally${i}`,area:'z0_1'});expect(invalid(s,h,{type:'MOVE',area:'z0_1'})).toMatch(/заполнена/);});
  it('both shooting from melee and at mixed areas are forbidden',()=>{const {s,h,e}=fixture();h.area=e.area;expect(invalid(s,h,shot())).toMatch(/рукопаш/);h.area='z1_1';s.units.push({...structuredClone(h),id:'ally',area:e.area});expect(invalid(s,h,shot())).toMatch(/рукопаш/);expect(invalid(s,h,{type:'SHOOT',weapon:'grenade',grenade:'frag',area:e.area})).toMatch(/рукопаш/);});
});
describe('armour, wounds and statuses',()=>{
  it('hit and penetration roll independently; aim is not penetration',()=>{const {s,h,e}=fixture();h.aim=true;e.loadout.armour='powered';dice(s,4,4,1,1);execute(s,shot());expect(e.hp).toBe(4);expect(s.stats.player.hits).toBe(1);expect(s.stats.player.penetrations).toBe(0);expect(e.armourCondition).toBe(0);});
  it('absorption after successful penetration; minimum one damage',()=>{const {s,e}=fixture('pistol');e.loadout.armour='plate';dice(s,3,3,6,6);execute(s,shot(e.id,'pistol'));expect(e.hp).toBe(3);expect(e.wounds).toEqual({HEAD:0,ARM:0,LEG:0,TORSO:0});});
  it('ignore armour bypasses both rolls and absorption',()=>{const {s,e}=fixture('flame');e.loadout.armour='plate';dice(s,3,3,4);execute(s,shot(e.id,'flame'));expect(e.hp).toBe(2);expect(s.stats.player.penetrationChecks).toBe(0);});
  it('sealed armour restores flamethrower penetration check',()=>{const {s,e}=fixture('flame');e.loadout.armour='sealed';dice(s,3,3,1,1);execute(s,shot(e.id,'flame'));expect(e.hp).toBe(4);expect(s.stats.player.penetrationChecks).toBe(1);});
  it('crit degrades only after penetration; promotes wound',()=>{const {s,e}=fixture('pistol');e.hp=e.maxHp=8;dice(s,6,6,6,6,4);execute(s,shot(e.id,'pistol'));expect(e.armourCondition).toBe(1);expect(e.wounds.LEG).toBe(2);});
  it('precision crits on 11 if hit',()=>{const {s,e}=fixture('sniper');e.hp=e.maxHp=10;dice(s,5,6,1,1);execute(s,shot(e.id,'sniper'));expect(s.stats.player.crits).toBe(1);expect(e.armourCondition).toBe(0);});
  it('armour condition table is exact',()=>{const {h}=fixture('rifle','powered');expect(effectiveArmour(h)).toEqual({protection:4,absorption:2});h.armourCondition=1;expect(effectiveArmour(h)).toEqual({protection:3,absorption:2});h.armourCondition=2;expect(effectiveArmour(h)).toEqual({protection:2,absorption:1});h.armourCondition=3;expect(effectiveArmour(h)).toEqual({protection:0,absorption:0});});
  it('single-hit thresholds; repeated light wounds escalate',()=>{const {s,h}=fixture();wound(s,h,1,false,'LEG');expect(h.wounds.LEG).toBe(0);wound(s,h,2,false,'LEG');expect(h.wounds.LEG).toBe(1);wound(s,h,2,false,'LEG');expect(h.wounds.LEG).toBe(2);wound(s,h,2,false,'LEG');expect(h.wounds.LEG).toBe(2);expect(hasStatus(h,'KNOCKED_DOWN')).toBe(true);});
  it.each([[1,'HEAD'],[2,'ARM'],[3,'ARM'],[4,'LEG'],[5,'TORSO'],[6,'TORSO']] as const)('location d6 %s → %s',(d,loc)=>{const {s,h}=fixture();dice(s,d);wound(s,h,2);expect(h.wounds[loc]).toBe(1);});
  it('head/arm trauma and recovery actions',()=>{const {s,h}=fixture();wound(s,h,4,true,'ARM');expect(h.statuses.DISARMED).toBeDefined();expect(h.droppedAt).toBe(h.area);h.ap=1;expect(execute(s,{type:'PICKUP'}).ok).toBe(true);expect(h.statuses.DISARMED).toBeUndefined();wound(s,h,4,true,'HEAD');expect(h.statuses.STUNNED).toBeDefined();});
  it('heavy arm blocks two handed but sidearm works',()=>{const {s,h}=fixture();h.wounds.ARM=2;expect(invalid(s,h,shot())).toBeDefined();expect(invalid(s,h,shot('enemy0','pistol'))).toBeUndefined();});
  it('zero HP clamps and defeats hero',()=>{const {s,h}=fixture();rawDamage(s,h,99);expect(h.hp).toBe(0);expect(maxActions(h)).toBe(0);expect(s.outcome).toBe('defeat');});
  it('fire and poison last two activations outside source',()=>{const {s,h}=fixture();setStatus(s,h,'BURNING',2);setStatus(s,h,'POISONED',2);next(s);expect(h.hp).toBe(6);next(s);expect(h.hp).toBe(4);expect(h.statuses.BURNING).toBeUndefined();expect(h.statuses.POISONED).toBeUndefined();});
  it('light bleeding waits for next own activation and expires',()=>{const {s,h}=fixture();wound(s,h,2,false,'TORSO');next(s);expect(h.hp).toBe(8);next(s);expect(h.hp).toBe(7);expect(h.statuses.BLEEDING_LIGHT).toBeUndefined();});
  it('flash does not stack; lasts through next activation',()=>{const {s,e}=fixture();setStatus(s,e,'BLINDED',1);setStatus(s,e,'BLINDED',1);expect(e.statuses.BLINDED?.duration).toBe(1);endActivation(s);expect(e.statuses.BLINDED).toBeDefined();endActivation(s);expect(e.statuses.BLINDED).toBeUndefined();});
  it('stun skips exactly the next activation',()=>{const {s,e}=fixture();setStatus(s,e,'STUNNED',1);endActivation(s);expect(actor(s).id).toBe(e.id);expect(e.ap).toBe(0);endActivation(s);expect(e.statuses.STUNNED).toBeUndefined();});
  it('acid damages and corrodes; sealed armour and respirator immunities work',()=>{const s=createBattle('toxic'),h=s.units[0];h.area='z2_0';dice(s,4);applyHazards(s,h);expect(h.hp).toBe(6);expect(h.armourCondition).toBe(1);h.loadout.armour='sealed';applyHazards(s,h);expect(h.hp).toBe(6);h.area='z2_1';applyHazards(s,h);expect(h.statuses.POISONED).toBeUndefined();});
  it('entangled prevents movement and has zero AP auto escape',()=>{const {s,h}=fixture();h.wounds.HEAD=1;setStatus(s,h,'ENTANGLED');expect(maxActions(h)).toBe(0);dice(s,5,5);endActivation(s);expect(h.statuses.ENTANGLED).toBeUndefined();});
  it('burst rolls for every eligible occupant and suppresses survivors',()=>{const {s,e}=fixture();e.hp=e.maxHp=10;e.loadout.utility='harness';s.units[2].area=e.area;s.units[2].hp=10;dice(s,4,4,1,1,4,4,1,1);execute(s,{...shot(),mode:'burst'});expect(s.stats.player.attacks).toBe(2);expect(e.statuses.SUPPRESSED).toBeDefined();expect(s.units[2].statuses.SUPPRESSED).toBeDefined();});
  it('grenade miss scatters deterministically to physical neighbour',()=>{const {s}=fixture();dice(s,1,1,1);execute(s,{type:'SHOOT',weapon:'grenade',grenade:'smoke',area:'z2_1'});expect(s.areas.z1_1.smoke).toBe(2);});
  it('smoke expires after two round cleanups',()=>{const {s}=fixture();s.areas.z1_1.smoke=2;next(s);expect(s.areas.z1_1.smoke).toBe(1);next(s);expect(s.areas.z1_1.smoke).toBe(0);});
  it('undo restores safe movement including RNG; shot creates barrier',()=>{const {s,h}=fixture();execute(s,{type:'MOVE',area:'z0_1'});const old=undo(s)!;expect(old.units[0].area).toBe('z1_1');dice(s,1,1);execute(s,shot());expect(undo(s)).toBeUndefined();expect(h.area).toBe('z0_1');});
  it('closed shutter blocks movement and line of sight',()=>{const s=createBattle('toxic');const h=s.units[0],e=s.units[1];h.area='z4_1';e.area='z1_1';execute(s,{type:'INTERACT',interaction:'shutter'});expect(invalid(s,h,{type:'MOVE',area:'z3_1'})).toBeDefined();expect(invalid(s,h,shot(e.id))).toMatch(/переборка/);});
});
function hasStatus(u:ReturnType<typeof actor>,status:Status){return Boolean(u.statuses[status]);}
describe('scenario invariants and AI parity',()=>{
  it.each(MAPS.map(m=>m.id))('%s is physically connected and has ≤21 areas',id=>{const m=MAPS.find(m=>m.id===id)!;expect(m.areas.length).toBeLessThanOrEqual(21);expect(new Set(m.areas.map(a=>a.id)).size).toBe(m.areas.length);for(const c of m.connections){expect(m.areas.some(a=>a.id===c.a)).toBe(true);expect(m.areas.some(a=>a.id===c.b)).toBe(true);} });
  it('both AIs use legal commands, deterministic full battle, no zero-HP acting',()=>{
    const run=()=>{const s=createBattle('terminal',227,DEFAULT_LOADOUT,false);let steps=0;while(!s.outcome&&s.round<=30&&steps++<700){const u=actor(s);if(u.ap===0||!aiStep(s,u.side==='player'?'aggressive':undefined))endActivation(s);for(const t of s.units){expect(t.hp).toBeGreaterThanOrEqual(0);expect(t.ap).toBeGreaterThanOrEqual(0);expect(new Set(t.used).size).toBe(t.used.length);}}return serialize(s);};expect(run()).toBe(run());
  });
});
