import {writeFileSync,mkdirSync} from 'node:fs';
import {MAPS} from '../src/data/maps';
import {DEFAULT_LOADOUT} from '../src/data/definitions';
import {actor,createBattle,endActivation,serialize} from '../src/engine/combat';
import {aiStep,type Strategy} from '../src/engine/ai';
import type {Loadout} from '../src/engine/types';

const nIndex=process.argv.indexOf('--battles');const count=nIndex<0?60:Number(process.argv[nIndex+1]);
const styles:Strategy[]=['aggressive','defensive','cover','ranged','melee','grenadier'];
const weapons=['rifle','sniper','repeater','shotgun','flame','smg','launcher'];
type Result={map:string;style:Strategy;weapon:string;battles:number;wins:number;timeouts:number;rounds:number;hits:number;attacks:number;pen:number;penChecks:number;damage:number;taken:number;cover:number;grenades:number;interactions:number;wounds:number;ap:number;granted:number;armour:number;actions:Record<string,number>;kills:Record<string,number>};
const rows:Result[]=[];let total=0;
for(const map of MAPS)for(const style of styles)for(const weapon of weapons){
  const r:Result={map:map.id,style,weapon,battles:count,wins:0,timeouts:0,rounds:0,hits:0,attacks:0,pen:0,penChecks:0,damage:0,taken:0,cover:0,grenades:0,interactions:0,wounds:0,ap:0,granted:0,armour:0,actions:{},kills:{}};
  for(let seed=1;seed<=count;seed++){
    const loadout:Loadout={...DEFAULT_LOADOUT,primary:weapon,melee:style==='melee'?'hammer':'blade',utility:map.id==='toxic'?'respirator':'visor'};
    const s=createBattle(map.id,seed*7919,loadout,false);let safety=0;
    while(!s.outcome&&s.round<=30&&safety++<2000){const u=actor(s);if(u.ap<=0||!aiStep(s,u.side==='player'?style:undefined))endActivation(s);}
    const p=s.stats.player;r.wins+=s.outcome==='victory'?1:0;r.timeouts+=!s.outcome?1:0;r.rounds+=s.round;r.hits+=p.hits;r.attacks+=p.attacks;r.pen+=p.penetrations;r.penChecks+=p.penetrationChecks;r.damage+=p.damage;r.taken+=p.damageTaken;r.cover+=p.cover;r.grenades+=p.grenades;r.interactions+=p.interactions;r.wounds+=p.wounds;r.ap+=p.apSpent;r.granted+=p.apGranted;r.armour+=s.units[0].armourCondition;
    for(const [key,value] of Object.entries(p.actions))r.actions[key]=(r.actions[key]??0)+value;
    for(const [key,value] of Object.entries(p.kills))r.kills[key]=(r.kills[key]??0)+value;
  }rows.push(r);total+=count;
}
const pct=(a:number,b:number)=>`${(100*a/Math.max(1,b)).toFixed(1)}%`;
const avg=(a:number,b:number)=>(a/Math.max(1,b)).toFixed(2);
let report=`# Balance simulation\n\nSeed sequence: 7919 × [1…${count}]. ${total} deterministic battles; six heuristic players, seven weapons, three maps. Round cap 30; timeout counts as failure. Player loadout: carapace, visor (respirator in toxic), frag + smoke, standard ammunition. Melee bot uses hammer. No hidden bonuses.\n\n|Map|Strategy|Weapon|Win|Rounds|Hit|Penetration|Damage|Taken|Cover|Grenades|Interactions|Timeouts|\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const r of rows)report+=`|${r.map}|${r.style}|${r.weapon}|${pct(r.wins,r.battles)}|${avg(r.rounds,r.battles)}|${pct(r.hits,r.attacks)}|${pct(r.pen,r.penChecks)}|${avg(r.damage,r.battles)}|${avg(r.taken,r.battles)}|${avg(r.cover,r.battles)}|${avg(r.grenades,r.battles)}|${avg(r.interactions,r.battles)}|${r.timeouts}|\n`;
report+='\n## Aggregate by map\n\n|Map|Win|Rounds|Wounds / battle|AP spent / granted|Armour condition at end|\n|---|---:|---:|---:|---:|---:|\n';
for(const map of MAPS){const subset=rows.filter(r=>r.map===map.id);const sum=(key:keyof Result)=>subset.reduce((n,r)=>n+Number(r[key]),0);report+=`|${map.name}|${pct(sum('wins'),sum('battles'))}|${avg(sum('rounds'),sum('battles'))}|${avg(sum('wounds'),sum('battles'))}|${pct(sum('ap'),sum('granted'))}|${avg(sum('armour'),sum('battles'))}|\n`;}
report+='\nRaw JSON also includes every action frequency, AI deaths by archetype, armour degradation and wounds. These bots are controlled probes, not an estimate of human win rate. Weapon and strategy rankings are confounded by heuristic quality; no claim of solved balance.\n';
mkdirSync('reports',{recursive:true});writeFileSync('reports/balance-latest.md',report);writeFileSync('reports/balance-latest.json',JSON.stringify({battles:total,seeds:count,rows},null,2));
console.log(report);
