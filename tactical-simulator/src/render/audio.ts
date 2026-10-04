export interface Settings {mute:boolean;sfx:number;ambience:number;reduceMotion:boolean;fastDice:boolean;largeLog:boolean;}
export const DEFAULT_SETTINGS:Settings={mute:false,sfx:0.5,ambience:0.16,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,fastDice:false,largeLog:false};
const names=['tap','dice','pistol','smg','rifle','shotgun','sniper','repeater','flame','grenade','explosion','flash','blade','hammer','armour','blood','break','footsteps','climb','jump','landing','fire','gas','machinery','ambience'];
/** Web Audio starts only inside a user gesture, including Safari's prefixed fallback. */
export class Sound {
  context?:AudioContext;buffers=new Map<string,AudioBuffer>();settings:Settings;ambient?:AudioBufferSourceNode;ambientGain?:GainNode;loading?:Promise<void>;
  constructor(settings:Settings){this.settings=settings;document.addEventListener('visibilitychange',()=>{if(!this.context)return;if(document.hidden)void this.context.suspend();else void this.context.resume();});}
  async unlock(){
    if(!this.context){const ctor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!ctor)return;this.context=new ctor();}
    await this.context.resume();
    if(!this.loading)this.loading=Promise.all(names.map(async name=>{try{const r=await fetch(`${import.meta.env.BASE_URL}assets/${name}.wav`);this.buffers.set(name,await this.context!.decodeAudioData(await r.arrayBuffer()));}catch{/* A silent game remains playable if audio is unavailable. */}})).then(()=>this.startAmbience());
    await this.loading;
  }
  startAmbience(){if(!this.context||this.ambient||!this.buffers.has('ambience'))return;this.ambient=this.context.createBufferSource();this.ambient.buffer=this.buffers.get('ambience')!;this.ambient.loop=true;this.ambientGain=this.context.createGain();this.ambient.connect(this.ambientGain).connect(this.context.destination);this.ambient.start();this.update(this.settings);}
  update(settings:Settings){this.settings=settings;if(this.ambientGain&&this.context)this.ambientGain.gain.setTargetAtTime(settings.mute?0:settings.ambience,this.context.currentTime,.1);}
  play(name:string){if(!this.context||this.settings.mute||document.hidden)return;const buffer=this.buffers.get(name);if(!buffer)return;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=this.settings.sfx;source.connect(gain).connect(this.context.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};}
}
