import type {Action, ArmourDefinition, Archetype, Grenade, Loadout, Status, WeaponDefinition} from '../engine/types';
const weapon=(id:string,name:string,short:string,range:number,accuracy:number,damage:number,pen:number,traits:string[],role:string):WeaponDefinition=>({id,name,short,range,accuracy,damage,pen,traits,role});
export const WEAPONS:Record<string,WeaponDefinition> = Object.fromEntries([
  weapon('pistol','Служебный пистолет','Пистолет',2,1,2,1,['BALLISTIC'],'Точный резерв; можно использовать с тяжёлой травмой руки.'),
  weapon('smg','Автоматический пистолет','Автопистолет',2,1,2,0,['BALLISTIC','AUTOMATIC'],'Ближний бой и подавление группы.'),
  weapon('rifle','Штурмовая винтовка','Винтовка',3,0,3,2,['BALLISTIC','AUTOMATIC','TWO_HANDED'],'Универсальная дистанция и очередь.'),
  weapon('shotgun','Траншейный дробовик','Дробовик',1,2,4,1,['BALLISTIC','IGNORE_COVER','NO_HEIGHT_RANGE','TWO_HANDED'],'Штурм укрытий с короткой дистанции.'),
  weapon('flame','Огнемётный проектор','Огнемёт',1,2,2,0,['IGNORE_COVER','IGNORE_ARMOUR','AREA','NO_HEIGHT_RANGE','TWO_HANDED','FIRE'],'Огонь по области; герметичная броня защищает.'),
  weapon('sniper','Марксманская винтовка','Марксман',4,1,4,3,['BALLISTIC','PRECISION','TWO_HANDED'],'Дальняя точная атака; с высоты дальность +2.'),
  weapon('launcher','Гранатомёт','Гранатомёт',2,0,3,2,['GRENADE','TWO_HANDED','IGNORE_COVER','NO_CRIT'],'Доставка выбранной гранаты на две зоны.'),
  weapon('repeater','Тяжёлый репитер','Репитер',3,-1,5,3,['BALLISTIC','HEAVY_RANGED','AUTOMATIC','SUPPRESSIVE','TWO_HANDED'],'Два действия: сильный удар и подавление.'),
  weapon('blade','Боевой клинок','Клинок',0,1,3,1,['MELEE'],'Надёжная атака и бесплатная контратака.'),
  weapon('hammer','Пробойный молот','Молот',0,-1,5,4,['MELEE','HEAVY_MELEE','ARMOR_BREAKER','TWO_HANDED'],'Два действия: ломает броню, тяжёлый крит сбивает с ног.'),
  weapon('grenade','Ручная граната','Граната',1,0,3,2,['GRENADE','IGNORE_COVER','NO_CRIT'],'Сохраняет укрытие. Использует Стрельбу.')
].map(w=>[w.id,w]));
export const ARMOURS:Record<string,ArmourDefinition> = {
  none:{id:'none',name:'Без брони',protection:0,absorption:0,traits:[]},
  light:{id:'light',name:'Лёгкая броня',protection:1,absorption:0,traits:[]},
  carapace:{id:'carapace',name:'Панцирь',protection:2,absorption:1,traits:[]},
  plate:{id:'plate',name:'Тяжёлая плита',protection:3,absorption:2,traits:['BULKY','DURABLE']},
  powered:{id:'powered',name:'Силовая оболочка',protection:4,absorption:2,traits:['BULKY','SERVO_ASSISTED']},
  sealed:{id:'sealed',name:'Изолирующий панцирь',protection:2,absorption:1,traits:['SEALED','FIRE_RESISTANT','CORROSION_RESISTANT']}
};
export const DEFAULT_LOADOUT:Loadout={primary:'rifle',sidearm:'pistol',melee:'blade',armour:'carapace',ammo:'standard',utility:'visor',grenades:['frag','smoke']};
export const UTILITIES:Record<string,{name:string;description:string}>={visor:{name:'Улучшенный визор',description:'+1 к стрелковым атакам'},harness:{name:'Страховочная система',description:'+1 к прыжку вниз'},respirator:{name:'Респиратор',description:'Иммунитет к токсичному газу'},stabiliser:{name:'Стабилизатор',description:'Первое подавление за бой игнорируется'}};
export const GRENADES:Record<Grenade,{name:string;description:string}>={frag:{name:'Осколочная',description:'Урон 3 · пробитие 2 · разрушает укрытия'},smoke:{name:'Дымовая',description:'Лёгкое укрытие на 2 раунда; нужно укрыться'},incendiary:{name:'Зажигательная',description:'Огненная область на 2 раунда'},gas:{name:'Газовая',description:'Токсичная область на 2 раунда'},flash:{name:'Светошумовая',description:'Ослепление: −2 к стрельбе на активацию'}};
export const ACTIONS:Record<Action,{name:string;icon:string;hint:string}>={
  MOVE:{name:'Движение',icon:'↗',hint:'Один физический переход в свободную область.'},RUSH:{name:'Рывок',icon:'»',hint:'Второе перемещение. Недоступно при ранении ноги.'},COVER:{name:'Укрыться',icon:'◧',hint:'Выберите защищённую сторону. Стрельба снимает укрытие.'},AIM:{name:'Прицелиться',icon:'⊕',hint:'Следующая стрельба: +1 попадание и дальность.'},SHOOT:{name:'Стрельба',icon:'⌖',hint:'Одна стрелковая атака за ход, включая гранаты.'},CHARGE:{name:'Чардж',icon:'↯',hint:'Шаг к врагу и атака. Все защитники отвечают.'},MELEE:{name:'Рукопашная',icon:'⚔',hint:'Атака в общей области. Цель бесплатно отвечает.'},RETREAT:{name:'Отступить',icon:'↶',hint:'Выйти из рукопашной без ответной атаки.'},CLIMB:{name:'Подъём',icon:'⇡',hint:'Только по лестнице. К занятой площадке готовит чардж.'},DESCEND:{name:'Спуск',icon:'⇣',hint:'Спуск по существующей лестнице.'},JUMP:{name:'Спрыгнуть',icon:'↡',hint:'2d6 + мобильность: 10+ возврат AP; 5− травма ноги.'},INTERACT:{name:'Механизм',icon:'⚙',hint:'Изменить окружение. Сохраняет укрытие.'},STAND:{name:'Встать',icon:'↑',hint:'Снять состояние «Сбит с ног».'},EXTINGUISH:{name:'Потушить',icon:'≈',hint:'Погасить горение. Огонь в области может зажечь снова.'},BANDAGE:{name:'Перевязать',icon:'✚',hint:'Остановить все виды кровотечения.'},ESCAPE:{name:'Освободиться',icon:'⋈',hint:'2d6 + мобильность ≥7 снимает опутывание.'},PICKUP:{name:'Поднять оружие',icon:'↥',hint:'Вернуть основное оружие в месте падения; сохраняет укрытие.'}
};
export const STATUSES:Record<Status,{name:string;icon:string;description:string}>={
  STUNNED:{name:'Оглушён',icon:'✹',description:'Следующая активация: 0 действий.'},ENTANGLED:{name:'Опутан',icon:'⋈',description:'−2 действия; перемещение запрещено. Освобождение: 7+.'},UNCONSCIOUS:{name:'Без сознания',icon:'×',description:'Выведен из боя.'},KNOCKED_DOWN:{name:'Сбит с ног',icon:'↧',description:'Нельзя рывок, чардж и прыжок. Используйте «Встать».'},DISARMED:{name:'Обезоружен',icon:'⊗',description:'Основное оружие нужно поднять там, где оно выпало.'},BLEEDING_LIGHT:{name:'Лёгкое кровотечение',icon:'♦',description:'−1 HP в конце следующей собственной активации.'},BLEEDING:{name:'Кровотечение',icon:'♦',description:'−1 HP каждый ход до перевязки.'},SEVERE_BLEEDING:{name:'Тяжёлое кровотечение',icon:'♦',description:'−2 HP каждый ход до перевязки.'},BURNING:{name:'Горит',icon:'♨',description:'−1 HP в конце активации, 2 активации. Можно потушить.'},POISONED:{name:'Отравлен',icon:'☣',description:'−1 к проверкам, −1 HP; 2 активации.'},BLINDED:{name:'Ослеплён',icon:'◉',description:'−2 к стрелковым атакам в следующую активацию.'},SUPPRESSED:{name:'Подавлен',icon:'≋',description:'−1 к стрельбе; нельзя прицеливаться; 1 активация.'}
};
export const BODY_NAMES={HEAD:'голова',ARM:'рука',LEG:'нога',TORSO:'торс'};
export const CONDITION_NAMES=['Целая','Повреждена','Пробита','Разрушена'];
export const ENEMIES:Record<Exclude<Archetype,'hero'>,{hp:number;ranged:number;melee:number;mobility:number;loadout:Partial<Loadout>}>= {
  rifleman:{hp:4,ranged:0,melee:0,mobility:0,loadout:{primary:'rifle',armour:'light',utility:'stabiliser'}},
  assault:{hp:4,ranged:0,melee:1,mobility:1,loadout:{primary:'smg',armour:'light',utility:'harness'}},
  sniper:{hp:4,ranged:0,melee:0,mobility:0,loadout:{primary:'sniper',armour:'light',utility:'stabiliser'}},
  heavy:{hp:7,ranged:0,melee:0,mobility:0,loadout:{primary:'repeater',armour:'plate',utility:'stabiliser'}},
  specialist:{hp:4,ranged:0,melee:0,mobility:0,loadout:{primary:'launcher',armour:'sealed',utility:'respirator',grenades:['frag','gas']}},
  commander:{hp:5,ranged:1,melee:1,mobility:1,loadout:{primary:'rifle',armour:'carapace',utility:'stabiliser',grenades:['frag','incendiary']}}
};
