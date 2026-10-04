import Phaser from 'phaser';
import {ACTIONS,STATUSES} from '../data/definitions';
import {getMap} from '../data/maps';
import {alive,area,occupants} from '../engine/combat';
import type {Battle,Command,Unit} from '../engine/types';
const STATES=['idle','move','rush','aim','shoot','burst','grenade_throw','melee','charge','hit','armour_hit','climb','descend','jump','landing','knockdown','stand','unconscious'];
const KINDS=['hero','rifleman','assault','sniper','heavy','specialist','commander'];
const EFFECTS=['muzzle','bullet','armour','blood','smoke','fire','toxic','acid','explosion','flash','break','status'];
export interface SceneHooks {getState:()=>Battle;areaTap:(id:string)=>void;unitTap:(id:string)=>void;longTap:(id:string)=>void;ready:()=>void;}
export class BattleScene extends Phaser.Scene {
  hooks:SceneHooks;terrain!:Phaser.GameObjects.Container;people!:Phaser.GameObjects.Container;overlay!:Phaser.GameObjects.Graphics;back?:Phaser.GameObjects.Image;front?:Phaser.GameObjects.Image;sprites=new Map<string,Phaser.GameObjects.Sprite>();unitLabels=new Map<string,Phaser.GameObjects.Container>();hazards:Phaser.GameObjects.Sprite[]=[];selected?:Command;legal:Command[]=[];reduceMotion=false;debug=false;mapId='';ready=false;lastLayout='';
  constructor(hooks:SceneHooks){super('Battle');this.hooks=hooks;}
  preload(){const base=import.meta.env.BASE_URL+'assets/';for(const map of ['terminal','foundry','toxic'])for(const layer of ['back','front'])this.load.image(`${map}-${layer}`,`${base}${map}-${layer}.png`);for(const kind of KINDS)this.load.spritesheet(kind,base+kind+'.png',{frameWidth:48,frameHeight:56});this.load.spritesheet('effects',base+'effects.png',{frameWidth:32,frameHeight:32});}
  create(){
    for(const kind of KINDS)for(const [i,state] of STATES.entries())this.anims.create({key:`${kind}-${state}`,frames:this.anims.generateFrameNumbers(kind,{start:i*4,end:i*4+3}),frameRate:state==='idle'?4:12,repeat:['idle','move','rush'].includes(state)?-1:0});
    for(const [i,effect] of EFFECTS.entries())this.anims.create({key:`fx-${effect}`,frames:this.anims.generateFrameNumbers('effects',{start:i*6,end:i*6+5}),frameRate:12,repeat:['smoke','fire','toxic','acid'].includes(effect)?-1:0});
    this.terrain=this.add.container(0,0).setDepth(2);this.people=this.add.container(0,0).setDepth(5);this.overlay=this.add.graphics().setDepth(4);this.ready=true;
    this.scale.on('resize',()=>this.redraw(true));this.redraw(true);this.hooks.ready();
  }
  pos(id:string){const a=area(this.hooks.getState(),id),w=this.scale.width,h=this.scale.height;return {x:w*(.085+a.zone*.1383),y:h*([.88,.65,.34][a.level])};}
  get factor(){return Math.max(.75,Math.min(this.scale.width/850,this.scale.height/290));}
  text(x:number,y:number,text:string,size=11,color='#c5d1c9'){return this.add.text(x,y,text,{fontFamily:'Arial, sans-serif',fontSize:`${size}px`,color,stroke:'#102025',strokeThickness:3}).setOrigin(.5,0);}
  redraw(force=false){
    if(!this.ready)return;const s=this.hooks.getState();const fingerprint=s.mapId+JSON.stringify([s.areas,s.switches,this.scale.width,this.scale.height]);
    if(force||fingerprint!==this.lastLayout){this.lastLayout=fingerprint;this.buildTerrain();}
    this.syncUnits();this.highlight();
  }
  buildTerrain(){
    const s=this.hooks.getState(),map=getMap(s.mapId),w=this.scale.width,h=this.scale.height;this.mapId=s.mapId;for(const child of this.terrain.list)this.tweens.killTweensOf(child);this.terrain.removeAll(true);for(const fx of this.hazards)fx.destroy();this.hazards=[];
    this.back?.destroy();this.front?.destroy();this.back=this.add.image(w/2,h/2,`${map.id}-back`).setDisplaySize(w+12,h+5).setDepth(0);this.front=this.add.image(w/2,h/2,`${map.id}-front`).setDisplaySize(w,h).setDepth(8);
    const g=this.add.graphics();this.terrain.add(g);const f=this.factor;
    // Physical edges first: solid bridges, ramps and readable ladders.
    for(const c of map.connections){const p=this.pos(c.a),q=this.pos(c.b);if(c.gate&&s.switches[c.gate]){g.fillStyle(0x76634b);g.fillRect((p.x+q.x)/2-8,p.y-65*f,16,70*f);g.lineStyle(2,0xc6ac6c);for(let y=p.y-60*f;y<p.y;y+=10)g.lineBetween((p.x+q.x)/2-7,y,(p.x+q.x)/2+7,y+7);continue;}
      if(c.kind==='ladder'){g.lineStyle(3*f,0x907957);g.lineBetween(p.x-12*f,p.y,p.x-12*f,q.y);g.lineBetween(p.x+12*f,p.y,p.x+12*f,q.y);g.lineStyle(2*f,0xb8a07a);for(let y=Math.min(p.y,q.y)+5;y<Math.max(p.y,q.y);y+=10*f)g.lineBetween(p.x-12*f,y,p.x+12*f,y);}
      else {g.lineStyle(9*f,0x15292c);g.lineBetween(p.x,p.y+7*f,q.x,q.y+7*f);g.lineStyle(2*f,0x586861);g.lineBetween(p.x,p.y,q.x,q.y);if(p.y===q.y){g.lineStyle(1,0x293e3f);for(let x=p.x+10;x<q.x;x+=12*f)g.lineBetween(x,p.y+2,x+8*f,p.y+9*f);}}
    }
    for(const a of map.areas){const p=this.pos(a.id),cover=s.areas[a.id].cover,aw=w*.108;
      g.fillStyle(0x17282d);g.fillRect(p.x-aw/2,p.y,aw,12*f);g.fillStyle(0x607068);g.fillRect(p.x-aw/2,p.y,aw,2*f);g.fillStyle(0x253d3c);g.fillRect(p.x-aw/2,p.y+4*f,aw,3*f);
      for(let x=p.x-aw/2+4*f;x<p.x+aw/2;x+=16*f){g.fillStyle(0x8d927b);g.fillRect(x,p.y+4*f,2*f,2*f);}
      if(a.elevated){g.lineStyle(3*f,0x2b4443);g.lineBetween(p.x-aw/2+7*f,p.y+11*f,p.x-aw/2+17*f,h*.94);g.lineStyle(1,0x4e6258);g.lineBetween(p.x-aw/2+9*f,p.y+11*f,p.x-aw/2+19*f,h*.94);g.lineStyle(1,0x55675b);g.lineBetween(p.x-aw/2,p.y-24*f,p.x+aw/2,p.y-24*f);for(const offset of [-.43,.43])g.lineBetween(p.x+aw*offset,p.y,p.x+aw*offset,p.y-25*f);}
      // Cover objects have recognisable silhouettes and stripes; they are not cell borders.
      const cx=p.x+aw*.18;
      if(cover===2){g.fillStyle(0x253f3f);g.fillRect(cx-18*f,p.y-35*f,37*f,34*f);g.lineStyle(2*f,0x668070);g.strokeRect(cx-18*f,p.y-35*f,37*f,34*f);for(let x=cx-12*f;x<cx+18*f;x+=7*f){g.lineStyle(1,0x466159);g.lineBetween(x,p.y-31*f,x,p.y-5*f);}g.fillStyle(0xa88e57);g.fillRect(cx-16*f,p.y-5*f,32*f,4*f);for(let x=cx-16*f;x<cx+16*f;x+=9*f){g.fillStyle(0x1a2b2c);g.fillRect(x,p.y-5*f,4*f,4*f);}}
      if(cover===1){g.fillStyle(0x544f3a);g.fillRect(cx-18*f,p.y-18*f,36*f,16*f);g.lineStyle(2,0x8b8060);g.strokeRect(cx-18*f,p.y-18*f,36*f,16*f);g.lineBetween(cx-16*f,p.y-16*f,cx+16*f,p.y-4*f);g.lineBetween(cx+16*f,p.y-16*f,cx-16*f,p.y-4*f);}
      const obj=map.interactions.find(o=>o.area===a.id||(o.kind==='lift'&&o.targets.includes(a.id)));
      if(obj){g.fillStyle(0x364b49);g.fillRect(p.x-aw*.37,p.y-28*f,17*f,26*f);g.fillStyle(s.switches[obj.id]?0x6d806d:0x9ecbc0);g.fillRect(p.x-aw*.37+3*f,p.y-25*f,11*f,9*f);g.fillStyle(0xc3a574);g.fillRect(p.x-aw*.37+5*f,p.y-12*f,3*f,2*f);const label=this.text(p.x-aw*.3,p.y-44*f,'⚙',13*f,'#e2c087');this.terrain.add(label);}
      const tag=this.text(p.x,p.y+15*f,`${a.zone+1}${a.elevated?' ↑':''}`,Math.max(10,10*f),'#85958d');this.terrain.add(tag);
      const zone=this.add.zone(p.x,p.y-19*f,Math.max(44,aw),Math.max(44,58*f)).setInteractive();zone.on('pointerdown',()=>this.hooks.areaTap(a.id));this.terrain.add(zone);
      const effects:string[]=Object.keys(s.areas[a.id].hazards).map(h=>h==='FIRE'?'fire':h==='TOXIC'?'toxic':'acid');if(s.areas[a.id].smoke)effects.push('smoke');
      for(const effect of effects){const fx=this.add.sprite(p.x,p.y-15*f,'effects').setDepth(6).setScale(2*f).setAlpha(effect==='smoke'?.65:.8).play(`fx-${effect}`);if(this.reduceMotion)fx.anims.pause();this.hazards.push(fx);}
    }
    // Slow drifting particles: fixed small pool, never gameplay RNG.
    for(let i=0;i<12;i++){const dust=this.add.rectangle((i*97+31)%w,(i*71+24)%h,2,2,0xc7ba8e,.15).setDepth(1);this.terrain.add(dust);if(!this.reduceMotion)this.tweens.add({targets:dust,y:'-=14',alpha:.03,duration:3500+(i%4)*800,yoyo:true,repeat:-1});}
  }
  unitPos(u:Unit){const p=this.pos(u.area),friends=this.hooks.getState().units.filter(v=>v.area===u.area&&alive(v)),index=Math.max(0,friends.findIndex(v=>v.id===u.id));return {x:p.x+(index-(friends.length-1)/2)*26*this.factor,y:p.y-2};}
  syncUnits(){
    const s=this.hooks.getState(),f=this.factor;
    for(const u of s.units){const p=this.unitPos(u);let sprite=this.sprites.get(u.id);
      if(!sprite){sprite=this.add.sprite(p.x,p.y,u.archetype).setOrigin(.5,.88).setDepth(5).setInteractive({useHandCursor:true});this.sprites.set(u.id,sprite);let down=0;let timer:Phaser.Time.TimerEvent|undefined;sprite.on('pointerdown',()=>{down=Date.now();timer=this.time.delayedCall(480,()=>this.hooks.longTap(u.id));});sprite.on('pointerup',()=>{timer?.remove();if(Date.now()-down<480)this.hooks.unitTap(u.id);});sprite.on('pointerout',()=>timer?.remove());}
      if(sprite.texture.key!==u.archetype)sprite.setTexture(u.archetype);
      sprite.setScale(1.4*f).setPosition(p.x,p.y).setFlipX(u.side==='enemy'&&area(s,u.area).zone>area(s,s.units[0].area).zone).setAlpha(alive(u)?1:.5);
      const state=!alive(u)?'unconscious':u.statuses.KNOCKED_DOWN?'knockdown':u.aim?'aim':'idle';sprite.play(`${u.archetype}-${state}`,true);if(this.reduceMotion)sprite.anims.pause();
      this.unitLabels.get(u.id)?.destroy();const labels=this.add.container(p.x,p.y).setDepth(7);this.unitLabels.set(u.id,labels);
      if(!alive(u))continue;const g=this.add.graphics();labels.add(g);const c=u.side==='player'?0x99d3c5:0xdc9474;
      g.fillStyle(0x040e12,.85);g.fillRect(-17*f,-71*f,34*f,5*f);g.fillStyle(c);g.fillRect(-17*f,-71*f,34*f*u.hp/u.maxHp,4*f);
      for(let hp=1;hp<u.maxHp;hp++){g.lineStyle(1,0x081519,.5);g.lineBetween((-17+34*hp/u.maxHp)*f,-71*f,(-17+34*hp/u.maxHp)*f,-67*f);}
      const name=this.text(0,-88*f,u.side==='player'?'ВЫ':`${u.archetype==='heavy'?'ТЯЖ':u.archetype==='sniper'?'СНП':u.archetype==='specialist'?'ХИМ':u.archetype==='assault'?'ШТ':u.archetype==='commander'?'КОМ':'СТР'}`,Math.max(10,10*f),u.side==='player'?'#bfe4d5':'#ddb396');labels.add(name);
      if(u.cover){const text=this.text(0,-64*f,`${u.cover==='LEFT'?'◀':'▶'} ◧`,12*f,'#e2c28c');labels.add(text);}
      if(u.intent&&u.side==='enemy'){const intent=this.text(25*f,-73*f,ACTIONS[u.intent.type].icon,14*f,'#e4bc80');labels.add(intent);}
      const statusText=Object.keys(u.statuses).map(k=>STATUSES[k as keyof typeof STATUSES].icon).join(' ');if(statusText)labels.add(this.text(0,-104*f,statusText,12*f,'#e6b184'));
      if(u.side==='player'){g.lineStyle(2,0xd9bb7f,.85);g.lineBetween(-14*f,7*f,14*f,7*f);g.lineBetween(-17*f,4*f,-14*f,7*f);g.lineBetween(17*f,4*f,14*f,7*f);}
    }
    for(const [id,sprite] of this.sprites)if(!s.units.some(u=>u.id===id)){sprite.destroy();this.sprites.delete(id);this.unitLabels.get(id)?.destroy();this.unitLabels.delete(id);}
  }
  setSelection(command:Command|undefined,legal:Command[]){this.selected=command;this.legal=legal;this.highlight();}
  highlight(){if(!this.overlay)return;const g=this.overlay;g.clear();const s=this.hooks.getState();const f=this.factor;
    for(const a of getMap(s.mapId).areas){const options=this.legal.filter(c=>c.area===a.id||c.target&&s.units.find(t=>t.id===c.target)?.area===a.id);if(!options.length&&!this.debug)continue;const p=this.pos(a.id);g.lineStyle(1.5,0xc2d9bc,.6);g.fillStyle(0x95baaa,.07);g.fillRoundedRect(p.x-32*f,p.y-42*f,64*f,43*f,3);g.strokeRoundedRect(p.x-32*f,p.y-42*f,64*f,43*f,3);}
    const targetId=this.selected?.area??s.units.find(u=>u.id===this.selected?.target)?.area;if(targetId){const p=this.pos(targetId),q=this.unitPos(s.units[0]);g.lineStyle(2,0xe0bc78,.9);g.strokeEllipse(p.x,p.y-20*f,64*f,70*f);if(this.selected?.type==='SHOOT'){g.lineStyle(1.5,0xe3b878,.6);g.lineBetween(q.x,q.y-35*f,p.x,p.y-35*f);}}
    if(this.debug){g.lineStyle(1,0x80d1cb,.6);for(const c of getMap(s.mapId).connections){const a=this.pos(c.a),b=this.pos(c.b);g.lineBetween(a.x,a.y,b.x,b.y);}}
  }
  async animate(before:Battle,command:Command){
    if(!this.ready)return;const s=this.hooks.getState(),u=s.units.find(u=>u.id===before.active)!,old=before.units.find(v=>v.id===u.id)!,sprite=this.sprites.get(u.id);if(!sprite)return;
    const state=command.type==='SHOOT'?(command.grenade?'grenade_throw':command.mode==='burst'?'burst':'shoot'):({MOVE:'move',RUSH:'rush',CHARGE:'charge',MELEE:'melee',CLIMB:'climb',DESCEND:'descend',JUMP:'jump',STAND:'stand',AIM:'aim'} as Record<string,string>)[command.type]??'idle';
    const duration=this.reduceMotion?60:command.type==='JUMP'?360:250;sprite.play(`${u.archetype}-${state}`,true);
    if(old.area!==u.area){const p=this.unitPos(u);this.tweens.add({targets:sprite,x:p.x,y:p.y,duration,ease:'Sine.easeInOut'});}
    const target=s.units.find(v=>v.id===command.target);if(target&&command.type==='SHOOT'&&!command.grenade){const from=this.unitPos(u),to=this.unitPos(target);const trace=this.add.graphics().setDepth(9).lineStyle(2,0xead1a0,.8);trace.lineBetween(from.x,from.y-32*this.factor,to.x,to.y-30*this.factor);this.time.delayedCall(80,()=>trace.destroy());}
    for(const t of s.units){const previous=before.units.find(v=>v.id===t.id);if(!previous)continue;const p=this.unitPos(t);if(t.hp<previous.hp||t.armourCondition>previous.armourCondition){const fx=this.add.sprite(p.x,p.y-28*this.factor,'effects').setDepth(9).setScale(2*this.factor).play(t.armourCondition>previous.armourCondition?'fx-break':'fx-blood');fx.once('animationcomplete',()=>fx.destroy());const label=this.text(p.x,p.y-60*this.factor,t.armourCondition>previous.armourCondition?'БРОНЯ ПОВРЕЖДЕНА':`−${previous.hp-t.hp}`,13,'#ead1b0').setDepth(10);this.tweens.add({targets:label,y:label.y-13,alpha:0,delay:250,duration:600,onComplete:()=>label.destroy()});if(!this.reduceMotion&&previous.hp-t.hp>=4)this.cameras.main.shake(130,.003);}}
    if(command.grenade&&command.area){const p=this.pos(command.area);const fx=this.add.sprite(p.x,p.y-20*this.factor,'effects').setDepth(9).setScale(3*this.factor).play(command.grenade==='flash'?'fx-flash':'fx-explosion');fx.once('animationcomplete',()=>fx.destroy());}
    await new Promise<void>(resolve=>this.time.delayedCall(duration,resolve));this.redraw();
  }
  update(time:number){if(this.back&&!this.reduceMotion)this.back.x=this.scale.width/2+Math.sin(time/12000)*3;}
}
