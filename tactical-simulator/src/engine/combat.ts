import {ACTIONS, ARMOURS, BODY_NAMES, DEFAULT_LOADOUT, ENEMIES, GRENADES, STATUSES, WEAPONS} from '../data/definitions';
import {getMap} from '../data/maps';
import {criticalProbability, d6, probability, roll, succeeds} from './random';
import type {Action, AreaDefinition, Battle, Command, Forecast, Grenade, Hazard, Loadout, Location, Side, Stats, Status, Unit, WeaponDefinition, Wound} from './types';

export const alive=(u:Unit)=>u.hp>0;
export const actor=(s:Battle)=>s.units.find(u=>u.id===s.active)!;
export const area=(s:Battle,id:string)=>getMap(s.mapId).areas.find(a=>a.id===id)!;
export const occupants=(s:Battle,id:string)=>s.units.filter(u=>u.area===id&&alive(u));
export const contested=(s:Battle,id:string)=>new Set(occupants(s,id).map(u=>u.side)).size>1;
export const has=(u:Unit,status:Status)=>Boolean(u.statuses[status]);
export const armour=(u:Unit)=>ARMOURS[u.loadout.armour];
export const trait=(u:Unit,t:string)=>u.armourCondition<3 && armour(u).traits.includes(t);
export const effectiveArmour=(u:Unit)=>({protection:u.armourCondition===3?0:Math.max(0,armour(u).protection-u.armourCondition),absorption:u.armourCondition===3?0:Math.max(0,armour(u).absorption-(u.armourCondition===2?1:0))});
export const woundPenalty=(u:Unit)=>Math.max(...Object.values(u.wounds));
export function maxActions(u:Unit):number {
  if(!alive(u)||has(u,'STUNNED')) return 0;
  const normal=Math.max(1,3-woundPenalty(u)-(trait(u,'BULKY')&&!trait(u,'SERVO_ASSISTED')?1:0));
  return has(u,'ENTANGLED')?Math.max(0,normal-2):normal;
}
export function addLog(s:Battle,text:string,kind: 'action'|'roll'|'damage'|'status'|'world'='world',u?:Unit,dice?:number[],target?:string) {
  s.eventId++; if(s.recordLog) s.log.push({id:s.eventId,round:s.round,actor:u?.id,text,kind,dice,target});
  if(s.log.length>700) s.log.splice(0,s.log.length-700);
}
const emptyStats=():Stats=>({shots:0,attacks:0,hits:0,crits:0,penetrationChecks:0,penetrations:0,damage:0,damageTaken:0,predictedHitTotal:0,actions:{},kills:{},wounds:0,cover:0,grenades:0,interactions:0,apSpent:0,apGranted:0});
function makeUnit(id:string,name:string,side:Side,archetype:Unit['archetype'],pos:string,loadout:Loadout):Unit {
  const def=archetype==='hero'?{hp:8,ranged:1,melee:1,mobility:1}:ENEMIES[archetype];
  return {id,name,side,archetype,area:pos,hp:def.hp,maxHp:def.hp,ranged:def.ranged,melee:def.melee,mobility:def.mobility,loadout:structuredClone(loadout),armourCondition:0,wounds:{HEAD:0,ARM:0,LEG:0,TORSO:0},statuses:{},aim:false,ap:0,spent:0,used:[],activation:0,stabiliserUsed:false};
}
export function createBattle(mapId='terminal',seed=4173,loadout:Loadout=DEFAULT_LOADOUT,recordLog=true):Battle {
  const m=getMap(mapId); const units=[makeUnit('hero','Оперативник', 'player','hero',m.playerArea,loadout),...m.deployment.map((d,i)=>makeUnit(`enemy${i}`,d.name,'enemy',d.archetype,d.area,{...DEFAULT_LOADOUT,...(d.archetype==='hero'?{}:ENEMIES[d.archetype].loadout)}))];
  const s:Battle={version:1,mapId,seed:seed>>>0,rng:seed>>>0,round:1,active:'hero',units,areas:Object.fromEntries(m.areas.map(a=>[a.id,{cover:a.cover,smoke:0,hazards:a.hazard?{[a.hazard]:-1}:{}}])),switches:{},log:[],eventId:0,stats:{player:emptyStats(),enemy:emptyStats()},forcedDice:[],recordLog};
  addLog(s,'Раунд 1. Ликвидируйте угрозы в секторе.'); startActivation(s,units[0]); return s;
}
export function serialize(s:Battle):string {return JSON.stringify({...s,undo:undefined});}
export function restore(json:string):Battle|undefined {
  try{const s=JSON.parse(json) as Battle;if(s.version!==1||!Array.isArray(s.units)||s.units.length<2||!s.units.some(u=>u.id===s.active)||!Number.isFinite(s.rng))return;const m=getMap(s.mapId);for(const u of s.units){if(!m.areas.some(a=>a.id===u.area)||!WEAPONS[u.loadout.primary]||!ARMOURS[u.loadout.armour]||!Number.isFinite(u.hp))return;}return s;}catch{return;}
}
export function setStatus(s:Battle,u:Unit,id:Status,duration=-1) {
  if(!alive(u)&&id!=='UNCONSCIOUS') return;
  if(id==='POISONED'&&(trait(u,'SEALED')||u.loadout.utility==='respirator')) return;
  if(id==='BURNING'&&trait(u,'FIRE_RESISTANT')) return;
  if(id==='SUPPRESSED'&&u.loadout.utility==='stabiliser'&&!u.stabiliserUsed){u.stabiliserUsed=true;addLog(s,`${u.name}: стабилизатор погасил подавление.`,'status',u);return;}
  const old=u.statuses[id]; u.statuses[id]={duration:Math.max(old?.duration??duration,duration),appliedActivation:u.activation};
  if(['STUNNED','KNOCKED_DOWN'].includes(id)) u.aim=false;
  if(!old) addLog(s,`${u.name}: ${STATUSES[id].name}${duration>0?` (${duration} акт.)`:''}.`,'status',u);
  if(s.active===u.id) u.ap=Math.min(u.ap,Math.max(0,maxActions(u)-u.spent));
}
export function removeStatus(s:Battle,u:Unit,id:Status) {if(has(u,id)){delete u.statuses[id];addLog(s,`${u.name}: «${STATUSES[id].name}» снято.`,'status',u);}}
function checkOutcome(s:Battle){if(!alive(s.units[0]))s.outcome='defeat';else if(!s.units.some(u=>u.side==='enemy'&&alive(u)))s.outcome='victory';}
export function rawDamage(s:Battle,u:Unit,n:number,source?:Unit){
  const dealt=Math.min(u.hp,Math.max(0,n));u.hp=Math.max(0,u.hp-dealt);s.stats[u.side].damageTaken+=dealt;if(source)s.stats[source.side].damage+=dealt;
  if(dealt)addLog(s,`${u.name}: −${dealt} HP (${u.hp}/${u.maxHp}).`,'damage',source??u,undefined,u.id);
  if(u.hp===0&&dealt){u.statuses={UNCONSCIOUS:{duration:-1,appliedActivation:u.activation}};u.ap=0;u.aim=false;delete u.cover;if(source){const kills=s.stats[source.side].kills;kills[u.archetype]=(kills[u.archetype]??0)+1;}addLog(s,`${u.name}: без сознания, выведен из боя.`,'status',u);}
  checkOutcome(s);
}
export function degradeArmour(s:Battle,u:Unit){if(armour(u).protection&&u.armourCondition<3){u.armourCondition=(u.armourCondition+1) as Unit['armourCondition'];addLog(s,`${u.name}: состояние брони ухудшено, ступень ${u.armourCondition}/3.`,'status',u);}}
export function wound(s:Battle,u:Unit,damage:number,critical=false,forced?:Location,source?:Unit) {
  if(!alive(u))return;
  let severity=damage>=4?2:damage>=2?1:0;if(critical)severity++;
  if(!severity)return;
  const die=forced?undefined:d6(s);const loc:Location=forced??(die===1?'HEAD':die===2||die===3?'ARM':die===4?'LEG':'TORSO');
  const before=u.wounds[loc];const trauma=severity>=3||before===2;
  u.wounds[loc]=Math.max(before,Math.min(2,severity+(before===1&&severity===1?1:0))) as Wound;
  s.stats[u.side].wounds++;
  addLog(s,`${u.name}: ${BODY_NAMES[loc]} — ${trauma?'критическая травма':u.wounds[loc]===2?'тяжёлое ранение':'лёгкое ранение'}${die?` (1d6 = ${die})`:''}.`,'status',u,die?[die]:undefined);
  if(loc==='TORSO'){
    delete u.statuses.BLEEDING_LIGHT;
    if(trauma){delete u.statuses.BLEEDING;setStatus(s,u,'SEVERE_BLEEDING');rawDamage(s,u,1,source);}
    else if(u.wounds.TORSO===2)setStatus(s,u,'BLEEDING');else if(!has(u,'BLEEDING')&&!has(u,'SEVERE_BLEEDING'))setStatus(s,u,'BLEEDING_LIGHT',1);
  }
  if(trauma&&loc==='HEAD')setStatus(s,u,'STUNNED',1);
  if(trauma&&loc==='ARM'){setStatus(s,u,'DISARMED');u.droppedAt=u.area;}
  if(trauma&&loc==='LEG')setStatus(s,u,'KNOCKED_DOWN');
  if(s.active===u.id)u.ap=Math.min(u.ap,Math.max(0,maxActions(u)-u.spent));
}
export function applyHazards(s:Battle,u:Unit){
  if(!alive(u))return;const h=s.areas[u.area].hazards;
  if(h.FIRE)setStatus(s,u,'BURNING',2);
  if(h.TOXIC)setStatus(s,u,'POISONED',2);
  if(h.ACID&&!trait(u,'CORROSION_RESISTANT')){rawDamage(s,u,2);degradeArmour(s,u);wound(s,u,2);}
}
export function startActivation(s:Battle,u:Unit){s.active=u.id;u.activation++;u.used=[];u.spent=0;u.ap=maxActions(u);delete u.ladderApproach;delete s.undo;s.stats[u.side].apGranted+=u.ap;addLog(s,`${u.name}: ${u.ap} действия.`,'action',u);}
export function endActivation(s:Battle){
  if(s.outcome)return;const u=actor(s);delete s.undo;applyHazards(s,u);
  if(alive(u)){
    for(const id of ['BURNING','POISONED','BLEEDING_LIGHT','BLEEDING','SEVERE_BLEEDING'] as Status[]){const st=u.statuses[id];if(st&&(id!=='BLEEDING_LIGHT'||st.appliedActivation<u.activation))rawDamage(s,u,id==='SEVERE_BLEEDING'?2:1);}
    if(has(u,'ENTANGLED')&&maxActions(u)===0){const dice=roll(s),mod=mobility(u);addLog(s,`Автоосвобождение: 2d6 = ${dice.join(' + ')}; мобильность ${mod>=0?'+':''}${mod}, нужно 8.`,'roll',u,dice);if(dice[0]+dice[1]+mod>=8)removeStatus(s,u,'ENTANGLED');}
    for(const [key,st] of Object.entries(u.statuses)){const id=key as Status;if(st.duration>0&&(st.appliedActivation<u.activation||id==='BURNING'||id==='POISONED')){st.duration--;if(st.duration===0)removeStatus(s,u,id);}}
  }
  u.ap=0;checkOutcome(s);if(s.outcome)return;
  const index=s.units.indexOf(u);const next=s.units.slice(index+1).find(alive);
  if(next){startActivation(s,next);return;}
  for(const ar of Object.values(s.areas)){if(ar.smoke>0)ar.smoke--;for(const h of Object.keys(ar.hazards) as Hazard[]){if((ar.hazards[h]??0)>0){ar.hazards[h]!--;if(ar.hazards[h]===0)delete ar.hazards[h];}}}
  s.round++;addLog(s,`Раунд ${s.round}.`);startActivation(s,s.units[0]);
}
export const mobility=(u:Unit)=>u.mobility-(has(u,'POISONED')?1:0);
export function connections(s:Battle,id:string,kind?:'walk'|'ladder') {return getMap(s.mapId).connections.filter(c=>(c.a===id||c.b===id)&&(!kind||c.kind===kind)&&!(c.gate&&s.switches[c.gate])).map(c=>({id:c.a===id?c.b:c.a,kind:c.kind}));}
export const capacity=(s:Battle,id:string,side:Side)=>occupants(s,id).filter(x=>x.side===side).length<3;
export function coverValue(s:Battle,target:Unit,attacker:Unit){const a=area(s,attacker.area),b=area(s,target.area);if(!target.cover||a.zone===b.zone)return 0;if((a.zone<b.zone?'LEFT':'RIGHT')!==target.cover)return 0;return Math.max(s.areas[target.area].cover,s.areas[target.area].smoke>0?1:0);}
export function blocksLine(s:Battle,from:string,to:string){const a=area(s,from),b=area(s,to);return getMap(s.mapId).connections.some(c=>{if(!c.gate||!s.switches[c.gate])return false;const l=area(s,c.a),r=area(s,c.b);return a.level===l.level&&b.level===l.level&&Math.min(a.zone,b.zone)<=Math.min(l.zone,r.zone)&&Math.max(a.zone,b.zone)>=Math.max(l.zone,r.zone);});}
export const getWeapon=(u:Unit,c:Command)=>WEAPONS[c.type==='MELEE'||c.type==='CHARGE'?u.loadout.melee:c.weapon??u.loadout.primary];
export function cost(u:Unit,c:Command){const w=getWeapon(u,c);return (c.type==='SHOOT'&&w?.traits.includes('HEAVY_RANGED'))||(['MELEE','CHARGE'].includes(c.type)&&w?.traits.includes('HEAVY_MELEE'))?2:1;}
const weaponAvailable=(u:Unit,w:WeaponDefinition)=>!(w.id===u.loadout.primary&&has(u,'DISARMED'))&&!(u.wounds.ARM===2&&(w.traits.includes('TWO_HANDED')||w.traits.includes('HEAVY_MELEE')||w.traits.includes('HEAVY_RANGED')));
function modifiers(s:Battle,u:Unit,w:WeaponDefinition,targetArea:AreaDefinition,target?:Unit,burst=false){
  const melee=w.traits.includes('MELEE');const height=!melee&&area(s,u.area).elevated&&!targetArea.elevated;
  const entries=[{label:'Навык',value:melee?u.melee:u.ranged},{label:'Оружие',value:w.accuracy}];
  const add=(label:string,value:number)=>{if(value)entries.push({label,value});};
  if(!melee){add('Прицеливание',u.aim?1:0);add('Высота',height?1:0);add('Визор',u.loadout.utility==='visor'?1:0);add('Ослепление',has(u,'BLINDED')?-2:0);add('Подавление',has(u,'SUPPRESSED')?-1:0);add('Очередь',burst?-1:0);if(target&&!w.traits.includes('IGNORE_COVER'))add('Лёгкое укрытие',coverValue(s,target,u)===1?-2:0);}
  add('Травма головы',-u.wounds.HEAD);add('Травма руки',u.wounds.ARM===2?-1:u.wounds.ARM===1&&w.traits.includes('TWO_HANDED')?-1:0);add('Отравление',has(u,'POISONED')?-1:0);
  return {entries,range:melee?0:w.range+(u.aim?1:0)+(height&&!w.traits.includes('NO_HEIGHT_RANGE')?(w.traits.includes('PRECISION')?2:1):0)};
}
function ammo(u:Unit,w:WeaponDefinition){return !w.traits.includes('BALLISTIC')?{damage:0,pen:0}:u.loadout.ammo==='piercing'?{damage:-1,pen:1}:u.loadout.ammo==='expanding'?{damage:1,pen:-1}:{damage:0,pen:0};}
export function forecast(s:Battle,u:Unit,target:Unit,c:Command):Forecast {
  const w=getWeapon(u,c);const m=modifiers(s,u,w,area(s,target.area),target,c.mode==='burst');const mod=m.entries.reduce((n,e)=>n+e.value,0);const ar=effectiveArmour(target);const ignored=w.traits.includes('IGNORE_ARMOUR')&&!(w.traits.includes('FIRE')&&trait(target,'SEALED'));const noArmour=ignored||ar.protection===0&&ar.absorption===0;const am=ammo(u,w);const fireReduction=w.traits.includes('FIRE')&&trait(target,'FIRE_RESISTANT')?1:0;
  const damage=Math.max(1,w.damage+am.damage-(ignored?0:ar.absorption)-fireReduction);const reason=targetReason(s,u,target,c);const crit=w.traits.includes('NO_CRIT')?0:criticalProbability(mod,w.traits.includes('PRECISION'));const hit=probability(mod);const basePen=noArmour?1:probability(w.pen+am.pen,8+ar.protection);const critPen=noArmour?1:probability(w.pen+am.pen+2,8+ar.protection);
  return {legal:!reason,reason,hit,penetration:hit?(basePen*(hit-crit)+critPen*crit)/hit:basePen,damage,critDamage:damage,critical:crit,wound:damage>=4?'тяжёлое':damage>=2?'лёгкое':'нет; крит: лёгкое',range:m.range,modifiers:m.entries,penModifiers:[{label:'Бронепробитие',value:w.pen},{label:'Боеприпасы',value:am.pen}],tn:8+ar.protection};
}
export function targetReason(s:Battle,u:Unit,t:Unit,c:Command):string|undefined {
  const w=getWeapon(u,c);if(!w)return 'Нет оружия';if(!alive(t)||t.side===u.side)return 'Недопустимая цель';
  if(c.type==='MELEE')return u.area!==t.area?'Цель в другой области':undefined;
  if(c.type==='CHARGE'){if(!capacity(s,t.area,u.side))return 'Область заполнена';if(t.area===u.area)return 'Вы уже в рукопашной';if(!connections(s,u.area,'walk').some(n=>n.id===t.area)&&u.ladderApproach!==t.area)return 'Нет пути для чарджа';return;}
  if(contested(s,u.area)||contested(s,t.area))return 'Стрельба в рукопашную запрещена';
  const from=area(s,u.area),to=area(s,t.area);if(Math.abs(from.zone-to.zone)>modifiers(s,u,w,to).range)return 'За пределами дальности';
  if(blocksLine(s,u.area,t.area))return 'Закрытая переборка';if(coverValue(s,t,u)===2&&!w.traits.includes('IGNORE_COVER'))return 'Цель за тяжёлым укрытием';
}
export function invalid(s:Battle,u:Unit,c:Command):string|undefined {
  if(s.outcome)return 'Бой завершён';if(u.id!==s.active)return 'Чужая активация';if(!alive(u))return 'Без сознания';if(!ACTIONS[c.type])return 'Неизвестное действие';if(u.used.includes(c.type))return 'Это действие уже использовано';if(u.ap<cost(u,c))return `Нужно ${cost(u,c)} действия`;
  const moving=['MOVE','RUSH','CHARGE','RETREAT','CLIMB','DESCEND','JUMP'].includes(c.type);
  if(moving&&has(u,'ENTANGLED'))return 'Персонаж опутан';if(['RUSH','CHARGE','JUMP'].includes(c.type)&&has(u,'KNOCKED_DOWN'))return 'Сначала встаньте';
  if(c.type==='RUSH'&&u.wounds.LEG)return 'Ранение ноги: рывок запрещён';if(c.type==='CHARGE'&&u.wounds.LEG===2)return 'Тяжёлое ранение ноги';
  if(moving&&contested(s,u.area)&&c.type!=='RETREAT')return 'В рукопашной используйте отступление';
  if(['MOVE','RUSH','RETREAT','CLIMB','DESCEND','JUMP'].includes(c.type)){
    if(!c.area||!s.areas[c.area])return 'Выберите область';if(c.type==='RETREAT'&&!contested(s,u.area))return 'Нет противников в вашей области';
    if(!capacity(s,c.area,u.side))return 'Область заполнена';const enemies=occupants(s,c.area).some(t=>t.side!==u.side);
    if(enemies&&c.type!=='CLIMB')return 'В занятую врагом область нужен чардж';
    if(c.type==='JUMP'){if(!area(s,u.area).elevated||area(s,u.area).drop!==c.area)return 'Нет места приземления';}
    else {const ladder=c.type==='CLIMB'||c.type==='DESCEND';if(!connections(s,u.area,ladder?'ladder':'walk').some(n=>n.id===c.area))return 'Нет физического перехода';if(c.type==='CLIMB'&&area(s,c.area).level<=area(s,u.area).level)return 'Лестница ведёт вниз';if(c.type==='DESCEND'&&area(s,c.area).level>=area(s,u.area).level)return 'Лестница ведёт вверх';}
  }
  if(c.type==='COVER'){if(!Math.max(s.areas[u.area].cover,s.areas[u.area].smoke?1:0))return 'Здесь нет укрытия';if(!c.direction)return 'Выберите сторону';if(contested(s,u.area))return 'Укрытие недоступно в рукопашной';}
  if(c.type==='AIM'&&(u.wounds.HEAD===2||has(u,'SUPPRESSED')))return 'Прицеливание недоступно';
  if(['SHOOT','MELEE','CHARGE'].includes(c.type)){
    const w=getWeapon(u,c);if(!w||!weaponAvailable(u,w))return 'Оружие недоступно из-за травмы или потери';
    if(c.type==='SHOOT'){
      if(![u.loadout.primary,u.loadout.sidearm,'grenade'].includes(w.id)||w.traits.includes('MELEE'))return 'Неэкипированное оружие';if(contested(s,u.area))return 'Сначала выйдите из рукопашной';
      if(c.mode==='burst'&&!w.traits.includes('AUTOMATIC'))return 'Оружие не автоматическое';
      if(w.traits.includes('GRENADE')){
        if(!c.grenade||!u.loadout.grenades.includes(c.grenade))return 'Выберите экипированную гранату';if(!c.area||!s.areas[c.area])return 'Выберите область';
        if(contested(s,c.area))return 'Стрельба в рукопашную запрещена';if(Math.abs(area(s,u.area).zone-area(s,c.area).zone)>modifiers(s,u,w,area(s,c.area)).range)return 'За пределами дальности';if(blocksLine(s,u.area,c.area))return 'Закрытая переборка';return;
      }
    }
    const t=s.units.find(t=>t.id===c.target);if(!t)return 'Выберите цель';return targetReason(s,u,t,c);
  }
  if(c.type==='INTERACT'){
    const obj=getMap(s.mapId).interactions.find(o=>o.id===c.interaction);if(!obj||(obj.area!==u.area&&!(obj.kind==='lift'&&obj.targets.includes(u.area))))return 'Нет доступного механизма';if(contested(s,u.area))return 'Механизм недоступен в рукопашной';if(obj.once&&s.switches[obj.id])return 'Механизм уже использован';
    if(obj.kind==='lift'||obj.kind==='conveyor'){const dest=u.area===obj.area?obj.targets[0]:obj.area;if(occupants(s,dest).some(t=>t.side!==u.side)||!capacity(s,dest,u.side))return 'Площадка назначения занята';}
  }
  const requires:Partial<Record<Action,Status>>={STAND:'KNOCKED_DOWN',EXTINGUISH:'BURNING',ESCAPE:'ENTANGLED',PICKUP:'DISARMED'};if(requires[c.type]&&!has(u,requires[c.type]!))return 'Состояние отсутствует';
  if(c.type==='PICKUP'&&u.droppedAt!==u.area)return 'Оружие осталось в другой области';if(c.type==='BANDAGE'&&!has(u,'BLEEDING')&&!has(u,'BLEEDING_LIGHT')&&!has(u,'SEVERE_BLEEDING'))return 'Нет кровотечения';
}
export function legalCommands(s:Battle,u:Unit=actor(s)):Command[]{
  if(s.outcome||u.id!==s.active)return [];const candidates:Command[]=[];
  for(const type of ['MOVE','RUSH','RETREAT','CLIMB','DESCEND','JUMP'] as Action[])for(const a of getMap(s.mapId).areas)candidates.push({type,area:a.id});
  candidates.push({type:'COVER',direction:'LEFT'},{type:'COVER',direction:'RIGHT'});
  for(const type of ['AIM','STAND','EXTINGUISH','BANDAGE','ESCAPE','PICKUP'] as Action[])candidates.push({type});
  for(const obj of getMap(s.mapId).interactions)candidates.push({type:'INTERACT',interaction:obj.id});
  for(const t of s.units.filter(t=>alive(t)&&t.side!==u.side)){
    candidates.push({type:'MELEE',target:t.id},{type:'CHARGE',target:t.id});
    for(const weapon of new Set([u.loadout.primary,u.loadout.sidearm])){
      if(WEAPONS[weapon].traits.includes('GRENADE'))continue;
      candidates.push({type:'SHOOT',weapon,target:t.id,mode:'single'});if(WEAPONS[weapon].traits.includes('AUTOMATIC'))candidates.push({type:'SHOOT',weapon,target:t.id,mode:'burst'});
    }
  }
  for(const weapon of u.loadout.primary==='launcher'?['grenade','launcher']:['grenade'])for(const grenade of u.loadout.grenades)for(const a of getMap(s.mapId).areas)candidates.push({type:'SHOOT',weapon,grenade,area:a.id});
  return candidates.filter(c=>!invalid(s,u,c));
}
function damageAfterHit(s:Battle,u:Unit,t:Unit,w:WeaponDefinition,critical:boolean){
  const ar=effectiveArmour(t),am=ammo(u,w);const ignored=w.traits.includes('IGNORE_ARMOUR')&&!(w.traits.includes('FIRE')&&trait(t,'SEALED'));let pierced=true;
  if(!ignored&&(ar.protection>0||ar.absorption>0)){
    const dice=roll(s),sum=dice[0]+dice[1],mod=w.pen+am.pen+(critical?2:0);pierced=succeeds(sum,mod,8+ar.protection);s.stats[u.side].penetrationChecks++;
    addLog(s,`Пробитие ${t.name}: 2d6 = ${dice.join(' + ')} = ${sum}; БП ${w.pen>=0?'+':''}${w.pen}, патрон ${am.pen>=0?'+':''}${am.pen}${critical?', крит +2':''}; итого ${sum+mod} против ${8+ar.protection}. ${pierced?'ПРОБИТИЕ':'БРОНЯ ВЫДЕРЖАЛА'}${sum===2?' (нат. 2)':sum===12?' (нат. 12)':''}.`,'roll',u,dice,t.id);
    if(pierced)s.stats[u.side].penetrations++;
  }else addLog(s,`${t.name}: ${ignored?'игнорирование брони':'броня отсутствует'}, проверка пробития пропущена.`,'action',u,undefined,t.id);
  if(w.traits.includes('ARMOR_BREAKER'))degradeArmour(s,t);
  if(!pierced)return false;
  const damage=Math.max(1,w.damage+am.damage-(ignored?0:ar.absorption)-(w.traits.includes('FIRE')&&trait(t,'FIRE_RESISTANT')?1:0));
  addLog(s,`Урон: ${w.damage}${am.damage?` ${am.damage>=0?'+':''}${am.damage}`:''} − поглощение ${ignored?0:ar.absorption} = ${damage}.`,'damage',u,undefined,t.id);
  rawDamage(s,t,damage,u);if(critical)degradeArmour(s,t);wound(s,t,damage,critical,undefined,u);
  if(critical&&damage>=4&&w.id==='hammer')setStatus(s,t,'KNOCKED_DOWN');return true;
}
function attack(s:Battle,u:Unit,t:Unit,w:WeaponDefinition,burst=false,reaction=false){
  if(!alive(u)||!alive(t)||!weaponAvailable(u,w))return false;
  const m=modifiers(s,u,w,area(s,t.area),t,burst),mod=m.entries.reduce((sum,e)=>sum+e.value,0),dice=roll(s),sum=dice[0]+dice[1],hit=succeeds(sum,mod),critical=hit&&!w.traits.includes('NO_CRIT')&&sum>=(w.traits.includes('PRECISION')?11:12);
  const st=s.stats[u.side];st.attacks++;st.predictedHitTotal+=probability(mod);if(hit)st.hits++;if(critical)st.crits++;
  addLog(s,`${reaction?'Контратака. ':''}${u.name} → ${t.name}: ${w.name}. Попадание: 2d6 = ${dice.join(' + ')} = ${sum}; ${m.entries.filter(e=>e.value).map(e=>`${e.label} ${e.value>0?'+':''}${e.value}`).join('; ')}. Итого ${sum+mod} против 7. ${critical?'КРИТИЧЕСКОЕ ПОПАДАНИЕ':hit?'ПОПАДАНИЕ':'ПРОМАХ'}${sum===2?' (нат. 2)':sum===12?' (нат. 12)':''}.`,'roll',u,dice,t.id);
  if(hit)damageAfterHit(s,u,t,w,critical);
  if(hit&&sum===12&&w.traits.includes('FIRE'))setStatus(s,t,'BURNING',2);
  return hit;
}
function counter(s:Battle,u:Unit,t:Unit){if(!alive(u)||!alive(t)||has(u,'STUNNED'))return;attack(s,u,t,WEAPONS[u.loadout.melee],false,true);}
function destroyCover(s:Battle,id:string,heavy:boolean){const a=area(s,id),state=s.areas[id];if(!a.destructible||!state.cover)return;state.cover=(state.cover===2?(heavy?1:2):0) as 0|1|2;addLog(s,`${a.name}: ${state.cover===1?'тяжёлое укрытие стало лёгким':state.cover===0?'укрытие разрушено':'тяжёлое укрытие выдержало'}.`);}
function grenade(s:Battle,u:Unit,c:Command){
  const w=getWeapon(u,c),m=modifiers(s,u,w,area(s,c.area!)),mod=m.entries.reduce((n,e)=>n+e.value,0),dice=roll(s),sum=dice[0]+dice[1],hit=succeeds(sum,mod);let dest=c.area!;
  const st=s.stats[u.side];st.attacks++;st.predictedHitTotal+=probability(mod);if(hit)st.hits++;
  addLog(s,`${GRENADES[c.grenade!].name}: 2d6 = ${dice.join(' + ')} = ${sum}; ${m.entries.filter(e=>e.value).map(e=>`${e.label} ${e.value>0?'+':''}${e.value}`).join('; ')}; ${sum+mod} против 7. ${hit?'ТОЧНО':'ОТКЛОНЕНИЕ'}.`,'roll',u,dice);
  if(!hit){const adjacent=connections(s,dest).map(n=>n.id).sort();const die=d6(s);addLog(s,`Отклонение: 1d6 = ${die}; порядок соседей: ${adjacent.join(', ')||'нет'}.`,'roll',u,[die]);if(!adjacent.length){addLog(s,'Граната ушла за пределы сектора.');return;}dest=adjacent[(die-1)%adjacent.length];}
  addLog(s,`${GRENADES[c.grenade!].name} → ${area(s,dest).name}.`,'world',u,undefined,dest);
  if(contested(s,dest)){addLog(s,'В смешанной области эффект гранаты заблокирован правилом запрета огня в рукопашную.');return;}
  if(c.grenade==='frag'){for(const t of occupants(s,dest).filter(t=>t.side!==u.side))damageAfterHit(s,u,t,WEAPONS.grenade,false);destroyCover(s,dest,true);}
  if(c.grenade==='smoke')s.areas[dest].smoke=2;
  if(c.grenade==='incendiary')s.areas[dest].hazards.FIRE=2;
  if(c.grenade==='gas')s.areas[dest].hazards.TOXIC=2;
  if(c.grenade==='flash')for(const t of occupants(s,dest).filter(t=>t.side!==u.side))setStatus(s,t,'BLINDED',1);
}
function relocate(s:Battle,u:Unit,dest:string,forced=false){u.area=dest;delete u.cover;if(forced)u.aim=false;applyHazards(s,u);}
function interact(s:Battle,u:Unit,c:Command){
  const o=getMap(s.mapId).interactions.find(o=>o.id===c.interaction)!;s.switches[o.id]=!s.switches[o.id];s.stats[u.side].interactions++;addLog(s,`${u.name}: ${o.name}. ${o.description}`,'world',u);
  if(o.kind==='lift'||o.kind==='conveyor')relocate(s,u,u.area===o.area?o.targets[0]:o.area,true);
  if(o.kind==='vent')for(const id of o.targets){delete s.areas[id].hazards.TOXIC;delete s.areas[id].hazards.ACID;}
  if(o.kind==='valve')for(const id of o.targets)s.areas[id].hazards.TOXIC=2;
  if(o.kind==='crane')for(const id of o.targets){for(const t of occupants(s,id)){rawDamage(s,t,4,u);wound(s,t,4,false,undefined,u);t.aim=false;delete t.cover;}s.areas[id].cover=1;}
}
export function execute(s:Battle,c:Command):{ok:boolean;reason?:string}{
  const u=actor(s),reason=invalid(s,u,c);if(reason)return {ok:false,reason};
  const safeMove=['MOVE','RUSH','RETREAT','DESCEND'].includes(c.type)&&c.area&&!Object.keys(s.areas[c.area].hazards).length;
  const previous=safeMove&&u.side==='player'?serialize(s):undefined;s.undo=undefined;
  const w=getWeapon(u,c);if(c.type!=='SHOOT')u.aim=false;
  if(!['INTERACT','PICKUP','COVER'].includes(c.type)&&!(c.type==='SHOOT'&&w.traits.includes('GRENADE')))delete u.cover;
  if(c.type!=='CHARGE')delete u.ladderApproach;
  const paid=cost(u,c);u.ap-=paid;u.spent+=paid;u.used.push(c.type);const st=s.stats[u.side];st.actions[c.type]=(st.actions[c.type]??0)+1;st.apSpent+=paid;
  addLog(s,`${u.name}: ${ACTIONS[c.type].name} (${paid} AP).`,'action',u);
  if(['MOVE','RUSH','RETREAT','DESCEND'].includes(c.type))relocate(s,u,c.area!);
  if(c.type==='CLIMB'){if(occupants(s,c.area!).some(t=>t.side!==u.side)){u.ladderApproach=c.area;addLog(s,'Лестница занята противником: подъём подготовлен, требуется Чардж.','action',u);}else relocate(s,u,c.area!);}
  if(c.type==='JUMP'){
    relocate(s,u,c.area!,true);const dice=roll(s),mod=mobility(u)-u.wounds.LEG-(trait(u,'BULKY')?1:0)+(u.loadout.utility==='harness'?1:0),result=dice[0]+dice[1]+mod;
    addLog(s,`Прыжок: 2d6 = ${dice.join(' + ')}; мобильность/снаряжение ${mod>=0?'+':''}${mod}; итого ${result}. ${result>=10?'ИДЕАЛЬНО: AP возвращён':result>=6?'Нормальное приземление':'Неудачно: 2 урона и травма ноги'}.`,'roll',u,dice);
    if(result>=10){u.ap++;u.spent--;st.apSpent--;}else if(result<=5){rawDamage(s,u,2);wound(s,u,2,false,'LEG');}
  }
  if(c.type==='COVER'){u.cover=c.direction;st.cover++;}
  if(c.type==='AIM')u.aim=true;
  if(c.type==='SHOOT'){
    st.shots++;
    if(w.traits.includes('GRENADE')){st.grenades++;grenade(s,u,c);}else{
      const target=s.units.find(t=>t.id===c.target)!;const targets=(c.mode==='burst'||w.traits.includes('AREA'))?occupants(s,target.area).filter(t=>t.side!==u.side&&!targetReason(s,u,t,c)).slice(0,3):[target];let hit=false;
      for(const t of targets)hit=attack(s,u,t,w,c.mode==='burst')||hit;
      if((c.mode==='burst'&&hit)||w.traits.includes('SUPPRESSIVE'))for(const t of targets.filter(alive))setStatus(s,t,'SUPPRESSED',1);
      if(hit&&(w.traits.includes('HEAVY_RANGED')||w.traits.includes('ARMOR_BREAKER')))destroyCover(s,target.area,w.traits.includes('ARMOR_BREAKER'));
    }u.aim=false;
  }
  if(c.type==='CHARGE'||c.type==='MELEE'){
    const t=s.units.find(t=>t.id===c.target)!;if(c.type==='CHARGE')relocate(s,u,t.area);
    if(alive(u)){attack(s,u,t,w);if(c.type==='CHARGE'){for(const defender of occupants(s,u.area).filter(v=>v.side!==u.side))counter(s,defender,u);}else counter(s,t,u);}delete u.ladderApproach;
  }
  if(c.type==='INTERACT')interact(s,u,c);
  if(c.type==='STAND')removeStatus(s,u,'KNOCKED_DOWN');
  if(c.type==='EXTINGUISH')removeStatus(s,u,'BURNING');
  if(c.type==='BANDAGE')for(const id of ['BLEEDING_LIGHT','BLEEDING','SEVERE_BLEEDING'] as Status[])removeStatus(s,u,id);
  if(c.type==='PICKUP'){removeStatus(s,u,'DISARMED');delete u.droppedAt;}
  if(c.type==='ESCAPE'){const dice=roll(s),mod=mobility(u);addLog(s,`Освобождение: 2d6 = ${dice.join(' + ')}; мобильность ${mod>=0?'+':''}${mod}, нужно 7.`,'roll',u,dice);if(dice[0]+dice[1]+mod>=7)removeStatus(s,u,'ENTANGLED');}
  checkOutcome(s);if(previous)s.undo=previous;return {ok:true};
}
export function undo(s:Battle):Battle|undefined {return s.undo?restore(s.undo):undefined;}
