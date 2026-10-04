import {WEAPONS} from '../data/definitions';
import {getMap} from '../data/maps';
import {actor, alive, area, connections, contested, coverValue, execute, forecast, has, legalCommands, maxActions, occupants} from './combat';
import type {Battle, Command, Unit} from './types';
export type Strategy='aggressive'|'defensive'|'cover'|'ranged'|'melee'|'grenadier';
export interface ScoredCommand {command:Command;score:number;reason:string;}
const sumHazard=(s:Battle,id:string,u:Unit)=>Object.keys(s.areas[id].hazards).reduce((n,h)=>n+(h==='TOXIC'&&(u.loadout.utility==='respirator'||u.loadout.armour==='sealed')?0:h==='ACID'?5:2.5),0);
function pathDistance(s:Battle,from:string,to:string):number {const seen=new Set([from]),queue:[string,number][]=[[from,0]];while(queue.length){const [at,d]=queue.shift()!;if(at===to)return d;for(const n of connections(s,at))if(!seen.has(n.id)){seen.add(n.id);queue.push([n.id,d+1]);}}return 30;}
function expected(s:Battle,u:Unit,t:Unit,command:Command){const f=forecast(s,u,t,command);return f.legal?f.hit*f.penetration*(Math.min(t.hp,f.damage)+(f.damage>=2?0.8:0))+(f.damage>=t.hp?f.hit*f.penetration:0):0;}
function firingValue(s:Battle,u:Unit,foes:Unit[]){const weapons=[u.loadout.primary,u.loadout.sidearm].filter(id=>!(u.wounds.ARM===2&&WEAPONS[id].traits.includes('TWO_HANDED'))&&!(id===u.loadout.primary&&has(u,'DISARMED')));return Math.max(0,...weapons.flatMap(weapon=>foes.map(t=>expected(s,u,t,{type:'SHOOT',weapon,target:t.id}))));}
export function rankCommands(s:Battle,u:Unit=actor(s),style:Strategy=u.archetype==='assault'?'aggressive':u.archetype==='sniper'?'ranged':u.archetype==='heavy'?'cover':u.archetype==='specialist'?'grenadier':'defensive'):ScoredCommand[]{
  const foes=s.units.filter(t=>t.side!==u.side&&alive(t));if(!foes.length)return [];
  const nearest=[...foes].sort((a,b)=>pathDistance(s,u.area,a.area)-pathDistance(s,u.area,b.area))[0];
  const shootingAvailable=!u.used.includes('SHOOT');const ownArea=area(s,u.area);const startDistance=pathDistance(s,u.area,nearest.area);
  const ranked=legalCommands(s,u).map(command=>{
    let score=-20,reason='резерв';const t=s.units.find(t=>t.id===command.target);
    switch(command.type){
      case 'SHOOT':{
        if(command.grenade){
          const targets=occupants(s,command.area!).filter(t=>t.side!==u.side),n=targets.length;const prior=s.areas[command.area!];
          if(command.grenade==='frag')score=targets.reduce((v,t)=>v+expected(s,u,t,command)*3.4,0)+(n>1?1:0);
          if(command.grenade==='flash')score=n?targets.reduce((v,t)=>v+(has(t,'BLINDED')?0.2:1.8),0):0;
          if(command.grenade==='gas'||command.grenade==='incendiary')score=targets.reduce((v,t)=>v+(t.loadout.armour==='sealed'?0.1:3),0)-(prior.hazards[command.grenade==='gas'?'TOXIC':'FIRE']?4:0);
          if(command.grenade==='smoke')score=command.area===u.area&&!prior.cover&&!prior.smoke&&u.ap>=2?2.8:0;
          if(style==='grenadier')score+=n?1.2:0;
          reason='граната / контроль области';
        }else if(t){score=expected(s,u,t,command)*3.5;const w=WEAPONS[command.weapon!];if(command.mode==='burst'||w.traits.includes('AREA')){score=occupants(s,t.area).filter(v=>v.side!==u.side).reduce((n,v)=>n+expected(s,u,v,command)*3.5,0);if(command.mode==='burst'&&!has(t,'SUPPRESSED'))score+=0.6;}
          if(w.traits.includes('HEAVY_RANGED'))score-=0.4;
          if(style==='melee')score*=0.65;reason='ожидаемый урон и подавление';}
        break;
      }
      case 'MELEE':case 'CHARGE':{
        if(!t)break;const defenders=command.type==='CHARGE'?occupants(s,t.area).filter(v=>v.side!==u.side):[t];const attackValue=expected(s,{...u,area:t.area},t,{...command,type:'MELEE'});const risk=defenders.reduce((n,v)=>n+expected(s,v,{...u,area:t.area},{type:'MELEE',target:u.id})*(v.hp<=WEAPONS[u.loadout.melee].damage?0.5:1),0);
        score=attackValue*3.8-risk*1.6+(style==='melee'?3.5:style==='aggressive'?1.5:0);reason='рукопашная с учётом ответов';break;
      }
      case 'COVER':{
        const probe={...u,cover:command.direction};const benefit=foes.reduce((n,t)=>n+coverValue(s,probe,t),0);
        score=benefit*(style==='cover'?2.5:style==='defensive'?1.5:1.1)+(u.ap===1?1.3:0)-(u.cover===command.direction?8:0)-(shootingAvailable&&u.ap>1?3:0);reason='защита со стороны угрозы';break;
      }
      case 'AIM':{
        if(u.aim){score=-2;break;}const aimValue=firingValue(s,{...u,aim:true},foes),base=firingValue(s,u,foes);
        score=contested(s,u.area)?-10:(aimValue-base)*3.5+(u.ap>=2&&shootingAvailable&&aimValue>0?2.8:0)+(u.used.includes('SHOOT')?1:0)-(u.cover?2:0);reason='выигрыш точности следующего выстрела';break;
      }
      case 'MOVE':case 'RUSH':case 'CLIMB':case 'DESCEND':case 'JUMP':case 'RETREAT':{
        const dest=command.area!,a=area(s,dest),probe={...u,area:dest,cover:undefined,aim:false};const dist=pathDistance(s,dest,nearest.area),range=Math.abs(a.zone-area(s,nearest.area).zone);const closer=startDistance-dist;
        const current=firingValue(s,u,foes),future=firingValue(s,probe,foes);score=(future-current)*2.3+(style==='melee'?closer*4:closer*1.5);
        if(style==='ranged'||u.archetype==='sniper'){score+=a.elevated&&!ownArea.elevated?2.5:0;score+=range>=2&&range<=4?0.5:-1;}
        if(range===0&&!contested(s,u.area)&&style!=='melee')score-=1;
        score+=(s.areas[dest].cover>0&&!u.used.includes('COVER')&&u.ap>1?1.4:0)-sumHazard(s,dest,u)*2;
        if(command.type==='JUMP')score-=1.1;
        if(contested(s,u.area))score+=u.hp<5||style==='ranged'||u.archetype==='heavy'?7:3;
        if(!shootingAvailable&&current>0&&future<current)score-=2;
        if(u.cover&&coverValue(s,u,nearest)>0)score-=1.4;
        for(const obj of getMap(s.mapId).interactions)if(!s.switches[obj.id]&&obj.kind==='crane'&&obj.targets.some(id=>occupants(s,id).some(t=>t.side!==u.side))){score+=(pathDistance(s,u.area,obj.area)-pathDistance(s,dest,obj.area))*2.2;if(obj.area===dest)score+=4;}
        reason='позиция, маршрут, опасности';break;
      }
      case 'INTERACT':{
        const obj=getMap(s.mapId).interactions.find(o=>o.id===command.interaction)!;
        score=obj.kind==='crane'?obj.targets.reduce((n,id)=>n+occupants(s,id).reduce((v,t)=>v+(t.side===u.side?-12:12),0),0):obj.kind==='vent'?obj.targets.reduce((n,id)=>n+Object.keys(s.areas[id].hazards).length*2,0):obj.kind==='valve'?obj.targets.reduce((n,id)=>n+occupants(s,id).reduce((v,t)=>v+(t.side===u.side?-3:3),0),0):obj.kind==='lift'?(!ownArea.elevated?3.3:0.5):obj.kind==='conveyor'?3:obj.kind==='shutter'?(s.switches[obj.id]?0:2):0;
        reason='изменение окружения';break;
      }
      case 'BANDAGE':score=has(u,'SEVERE_BLEEDING')?11:has(u,'BLEEDING')?7:2;reason='остановить потерю HP';break;
      case 'EXTINGUISH':score=s.areas[u.area].hazards.FIRE?0:6;reason='остановить горение';break;
      case 'STAND':score=style==='melee'?9:3;reason='вернуть подвижность';break;
      case 'ESCAPE':score=8;reason='восстановить движение';break;
      case 'PICKUP':score=6;reason='вернуть основное оружие';break;
    }
    return {command,score:Number(score.toFixed(4)),reason};
  });
  return ranked.sort((a,b)=>b.score-a.score||JSON.stringify(a.command).localeCompare(JSON.stringify(b.command)));
}
export function chooseCommand(s:Battle,style?:Strategy):Command|undefined {const first=rankCommands(s,actor(s),style)[0];return first&&first.score>0?first.command:undefined;}
export function refreshIntents(s:Battle){
  for(const u of s.units.filter(u=>u.side==='enemy'&&alive(u))){const probe=structuredClone(u);probe.ap=maxActions(probe);probe.used=[];probe.spent=0;const view={...s,active:u.id,units:s.units.map(v=>v.id===u.id?probe:v)};u.intent=rankCommands(view,probe)[0]?.command;}
}
export function aiStep(s:Battle,style?:Strategy){const command=chooseCommand(s,style);return command?execute(s,command).ok:false;}
