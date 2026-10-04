import type {AreaDefinition, Connection, MapDefinition} from '../engine/types';
const a=(zone:number,level:0|1|2,name:string,cover:0|1|2=0,decor='floor',extra:Partial<AreaDefinition>={}):AreaDefinition=>({id:`z${zone}_${level}`,zone,level,name,cover,decor,elevated:level===2,destructible:cover>0,...extra});
const path=(level:number,zones:number[]):Connection[]=>zones.slice(1).map((z,i)=>({a:`z${zones[i]}_${level}`,b:`z${z}_${level}`,kind:'walk'}));
const link=(a:string,b:string,kind:'walk'|'ladder'='walk',gate?:string):Connection=>({a,b,kind,gate});
export const MAPS:MapDefinition[]=[{
  id:'terminal',name:'Грузовой терминал',subtitle:'01 / ЛИНИЯ ПРИБЫТИЯ',color:'#caac77',
  description:'Груз замер между этажами. Двое охранников держат дальний конец терминала. Подъёмник открывает путь над их укрытиями.',
  lesson:'Укрытие работает только после действия «Укрыться». Обходите защищённую сторону.',
  playerArea:'z0_1',
  areas:[a(0,1,'Входная рампа',1,'barricade'),a(1,1,'Рельсовый путь'),a(2,1,'Грузовой пульт',1,'console'),a(3,1,'Контейнер №04',2,'container'),a(4,1,'Складские паллеты',1,'crates'),a(5,1,'Опора галереи'),a(6,1,'Выходной шлюз',2,'door'),a(2,2,'Верх подъёмника',0,'platform',{drop:'z2_1'}),a(3,2,'Погрузочный мост',1,'platform',{drop:'z3_1'}),a(4,2,'Лестничная площадка',0,'platform',{drop:'z4_1'}),a(0,0,'Нижний съезд'),a(1,0,'Сервисный туннель',1,'pipes'),a(2,0,'Кабельный канал'),a(3,0,'Сервисный выход')],
  connections:[...path(1,[0,1,2,3,4,5,6]),...path(2,[2,3,4]),...path(0,[0,1,2,3]),link('z0_1','z0_0'),link('z3_0','z3_1'),link('z4_1','z4_2','ladder')],
  interactions:[{id:'lift',name:'Грузовой подъёмник',area:'z2_1',kind:'lift',targets:['z2_2'],description:'Поднимает на галерею. Наверху можно вернуть кабину вниз.'}],
  deployment:[{archetype:'rifleman',name:'Стрелок «Скоба»',area:'z4_1'},{archetype:'assault',name:'Штурмовик «Шлак»',area:'z6_1'}]
},{
  id:'foundry',name:'Литейная галерея',subtitle:'02 / ГОРЯЧИЙ КОНТУР',color:'#d37f4e',
  description:'Марксман перекрывает верхнюю галерею. Репитер держит цех. Доберитесь до крана: подвешенный груз изменит расстановку сил.',
  lesson:'На одной высоте бонусы вышки исчезают. Лестницы расположены в разных концах цеха.',
  playerArea:'z0_1',
  areas:[a(0,1,'Аварийный вход',2,'container'),a(1,1,'Лестница цеха',1,'crates'),a(2,1,'Печь №2',0,'furnace',{hazard:'FIRE'}),a(3,1,'Разливочный пост',1,'pipes'),a(4,1,'Пульт крана',2,'console'),a(5,1,'Рабочая площадка'),a(6,1,'Узел охлаждения',2,'container'),...Array.from({length:5},(_,i)=>a(i+1,2,['Подъёмная секция','Мост над печью','Верхняя галерея','Тельфер','Смотровой пост'][i],i===2||i===4?1:0,'platform',{drop:`z${i+1}_1`})),a(0,0,'Нижний проход'),a(1,0,'Шлаковый канал'),a(2,0,'Погрузочная ниша',1,'crates'),a(3,0,'Нижняя переборка',2,'container'),a(4,0,'Вентиляционный ход'),a(5,0,'Нижняя лестница'),a(6,0,'Насосная',1,'pipes')],
  connections:[...path(1,[0,1,2,3,4,5,6]),...path(2,[1,2,3,4,5]),...path(0,[0,1,2,3,4,5,6]),link('z0_1','z0_0'),link('z6_0','z6_1'),link('z1_1','z1_2','ladder'),link('z5_1','z5_2','ladder')],
  interactions:[{id:'crane',name:'Аварийный сброс груза',area:'z3_2',kind:'crane',targets:['z5_2','z6_1'],once:true,description:'4 урона без поглощения в двух дальних областях. Сбрасывает укрытия; оставляет обломки.'},{id:'conveyor',name:'Транспортёр',area:'z2_0',kind:'conveyor',targets:['z4_0'],description:'Перевозит оператора под центральную галерею.'}],
  deployment:[{archetype:'sniper',name:'Марксман «Око»',area:'z5_2'},{archetype:'heavy',name:'Тяжёлый «Тигель»',area:'z6_1'},{archetype:'assault',name:'Штурмовик «Зола»',area:'z3_0'}]
},{
  id:'toxic',name:'Токсичный узел',subtitle:'03 / ЗАМКНУТЫЙ ЦИКЛ',color:'#92b28b',
  description:'Газ заполняет центральный проход. Кислота отрезает нижний. Вентиляция и защитная переборка позволяют разделить отряд противника.',
  lesson:'Респиратор защищает от газа. Кислота разрушает броню; управляйте опасностями с пультов.',
  playerArea:'z0_1',
  areas:[a(0,1,'Станция очистки',2,'console'),a(1,1,'Впускной коллектор',1,'pipes'),a(2,1,'Газовый ресивер',0,'tank',{hazard:'TOXIC'}),a(3,1,'Центральная переборка',2,'door'),a(4,1,'Реакторный пульт',1,'console'),a(5,1,'Фильтрационный блок',1,'tank'),a(6,1,'Командный шлюз',2,'door'),...Array.from({length:5},(_,i)=>a(i+1,2,['Первая лестница','Обходная труба','Сервисная галерея','Створки вентиляции','Верхний пост'][i],i===4?1:0,'platform',{drop:`z${i+1}_1`})),a(0,0,'Нижний люк'),a(1,0,'Дренажный путь'),a(2,0,'Кислотный сток',0,'acid',{hazard:'ACID'}),a(3,0,'Сухой отстойник',1,'crates'),a(4,0,'Насосный пульт',1,'console'),a(5,0,'Компрессор'),a(6,0,'Сервисный подъём')],
  connections:[...path(1,[0,1,2,3]),link('z3_1','z4_1','walk','shutter'),...path(1,[4,5,6]),...path(2,[1,2,3,4,5]),...path(0,[0,1,2,3,4,5,6]),link('z0_1','z0_0'),link('z6_1','z6_0'),link('z1_1','z1_2','ladder'),link('z5_1','z5_2','ladder')],
  interactions:[{id:'vent',name:'Продувка контура',area:'z0_1',kind:'vent',targets:['z2_1','z2_0','z4_1','z5_1'],description:'Очищает газ и кислоту в центральной части, включая новые облака.'},{id:'valve',name:'Сброс реагента',area:'z4_0',kind:'valve',targets:['z4_1','z5_1'],description:'Заполняет верхние рабочие посты токсичным газом на 2 раунда.'},{id:'shutter',name:'Защитная переборка',area:'z4_1',kind:'shutter',targets:['z3_1'],description:'Закрывает или открывает центральный переход и линии огня через него.'}],
  deployment:[{archetype:'specialist',name:'Химик «Осадок»',area:'z4_1'},{archetype:'commander',name:'Командир «Вектор»',area:'z6_1'},{archetype:'assault',name:'Штурмовик «Пена»',area:'z3_0'},{archetype:'rifleman',name:'Стрелок «Фильтр»',area:'z5_2'}]
}];
export function getMap(id:string):MapDefinition { const m=MAPS.find(m=>m.id===id); if(!m) throw new Error(`Unknown map: ${id}`); return m; }
