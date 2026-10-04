export type Side = 'player' | 'enemy';
export type Direction = 'LEFT' | 'RIGHT';
export type Location = 'HEAD' | 'ARM' | 'LEG' | 'TORSO';
export type Wound = 0 | 1 | 2;
export type Status = 'STUNNED' | 'ENTANGLED' | 'UNCONSCIOUS' | 'KNOCKED_DOWN' | 'DISARMED' | 'BLEEDING_LIGHT' | 'BLEEDING' | 'SEVERE_BLEEDING' | 'BURNING' | 'POISONED' | 'BLINDED' | 'SUPPRESSED';
export type Action = 'MOVE' | 'RUSH' | 'COVER' | 'AIM' | 'SHOOT' | 'CHARGE' | 'MELEE' | 'RETREAT' | 'CLIMB' | 'DESCEND' | 'JUMP' | 'INTERACT' | 'STAND' | 'EXTINGUISH' | 'BANDAGE' | 'ESCAPE' | 'PICKUP';
export type Grenade = 'frag' | 'smoke' | 'incendiary' | 'gas' | 'flash';
export type Hazard = 'FIRE' | 'TOXIC' | 'ACID';
export type Archetype = 'hero' | 'rifleman' | 'assault' | 'sniper' | 'heavy' | 'specialist' | 'commander';
export interface WeaponDefinition { id: string; name: string; short: string; range: number; accuracy: number; damage: number; pen: number; traits: string[]; role: string; }
export interface ArmourDefinition { id: string; name: string; protection: number; absorption: number; traits: string[]; }
export interface Loadout { primary: string; sidearm: string; melee: string; armour: string; ammo: 'standard' | 'piercing' | 'expanding'; utility: string; grenades: Grenade[]; }
export interface AreaDefinition { id: string; zone: number; level: 0 | 1 | 2; name: string; elevated: boolean; cover: 0 | 1 | 2; destructible?: boolean; drop?: string; hazard?: Hazard; decor: string; }
export interface Connection { a: string; b: string; kind: 'walk' | 'ladder'; gate?: string; }
export interface InteractiveDefinition { id: string; name: string; area: string; kind: 'lift' | 'crane' | 'vent' | 'valve' | 'shutter' | 'conveyor' | 'lights'; targets: string[]; description: string; once?: boolean; }
export interface Deployment { archetype: Archetype; area: string; name: string; }
export interface MapDefinition { id: string; name: string; subtitle: string; description: string; lesson: string; color: string; areas: AreaDefinition[]; connections: Connection[]; interactions: InteractiveDefinition[]; deployment: Deployment[]; playerArea: string; }
export interface StatusInstance { duration: number; appliedActivation: number; }
export interface Unit { id: string; name: string; side: Side; archetype: Archetype; area: string; hp: number; maxHp: number; ranged: number; melee: number; mobility: number; loadout: Loadout; armourCondition: 0 | 1 | 2 | 3; wounds: Record<Location,Wound>; statuses: Partial<Record<Status,StatusInstance>>; cover?: Direction; aim: boolean; ap: number; spent: number; used: Action[]; activation: number; ladderApproach?: string; droppedAt?: string; stabiliserUsed: boolean; intent?: Command; }
export interface Command { type: Action; area?: string; target?: string; direction?: Direction; weapon?: string; mode?: 'single' | 'burst'; grenade?: Grenade; interaction?: string; }
export interface AreaState { cover: 0 | 1 | 2; smoke: number; hazards: Partial<Record<Hazard,number>>; }
export interface LogEntry { id: number; round: number; actor?: string; text: string; kind: 'action' | 'roll' | 'damage' | 'status' | 'world'; dice?: number[]; target?: string; }
export interface Stats { shots: number; attacks: number; hits: number; crits: number; penetrationChecks: number; penetrations: number; damage: number; damageTaken: number; predictedHitTotal: number; actions: Partial<Record<Action,number>>; kills: Partial<Record<Archetype,number>>; wounds: number; cover: number; grenades: number; interactions: number; apSpent: number; apGranted: number; }
export interface Battle { version: 1; mapId: string; seed: number; rng: number; round: number; active: string; units: Unit[]; areas: Record<string,AreaState>; switches: Record<string,boolean>; log: LogEntry[]; eventId: number; stats: Record<Side,Stats>; outcome?: 'victory' | 'defeat'; forcedDice: number[]; undo?: string; recordLog: boolean; }
export interface Forecast { legal: boolean; reason?: string; hit: number; penetration: number; damage: number; critDamage: number; critical: number; wound: string; range: number; modifiers: {label: string; value: number}[]; penModifiers: {label: string; value: number}[]; tn: number; }
