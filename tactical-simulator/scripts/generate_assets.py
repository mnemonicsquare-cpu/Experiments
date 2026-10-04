"""Original procedural pixel art and PCM sound. No downloaded assets. Python + Pillow.
Coordinate work is at native pixel resolution; browser uses nearest-neighbour scaling.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import random, math, wave, struct, json

OUT=Path(__file__).resolve().parents[1]/'public'/'assets'
OUT.mkdir(parents=True,exist_ok=True)
R=random.Random(4173)

def background(name,accent):
    w,h=768,384
    im=Image.new('RGB',(w,h));d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/h;d.line((0,y,w,y),fill=(int(9+10*t),int(20+7*t),int(24+6*t)))
    # Hazy machinery hall, rows of tall industrial gothic arches.
    for x in range(-34,w,110):
        d.rectangle((x+8,52,x+93,316),fill=(14,29,32))
        d.polygon([(x+8,76),(x+8,45),(x+51,16),(x+93,45),(x+93,76)],fill=(18,35,38))
        d.line([(x+10,290),(x+10,58),(x+51,29),(x+90,58),(x+90,291)],fill=(33,48,48),width=3)
        d.line((x+48,35,x+48,295),fill=(23,40,41),width=5)
        for y in range(82,280,47):
            d.rectangle((x+14,y,x+85,y+2),fill=(28,43,44))
            for xx in range(x+17,x+85,7):
                d.line((xx,y+3,xx-7,y+19),fill=(20,35,37))
        d.rectangle((x-2,0,x+5,h),fill=(28,38,39));d.line((x+5,0,x+5,h),fill=(42,49,47))
    # Distant gantries and fine cables.
    for y in [93,227,313]:
        d.rectangle((0,y,w,y+5),fill=(31,40,40));d.line((0,y,w,y),fill=(55,57,51))
        for x in range(0,w,25):d.line((x,y+5,x+17,y+22),fill=(19,32,33),width=2)
    for x in [47,229,507,695]:
        d.line((x,0,x,110),fill=(7,15,19),width=2)
        d.rectangle((x-9,108,x+9,111),fill=(80,72,55));d.rectangle((x-7,112,x+7,114),fill=accent)
    # Pipes, tanks, access panels and rivets.
    for x,y,hh in [(24,130,152),(124,178,112),(296,131,168),(449,161,142),(593,143,158),(710,152,149)]:
        rw=R.randrange(25,49);d.rounded_rectangle((x,y,x+rw,y+hh),radius=11,fill=(29,44,45),outline=(45,57,53),width=2)
        d.rectangle((x+6,y+8,x+11,y+hh-7),fill=(37,51,50));d.rectangle((x+rw-7,y+8,x+rw-2,y+hh-7),fill=(16,30,33))
        for yy in [y+24,y+hh-23]:d.rectangle((x-4,yy,x+rw+4,yy+4),fill=(57,63,57));d.point((x,yy+1),fill=(108,97,68))
        d.rectangle((x+rw//2-3,y+hh//2,x+rw//2+4,y+hh//2+10),fill=(16,27,29));d.point((x+rw//2,y+hh//2+3),fill=accent)
    for i in range(11):
        x=R.randrange(w);y=R.randrange(120,310)
        d.line((x,y,x+50,y),fill=(43,54,51),width=5);d.line((x,y-2,x+50,y-2),fill=(64,66,55))
        for xx in range(x,x+51,17):d.rectangle((xx,y-4,xx+2,y+3),fill=(78,71,53))
    if name=='foundry':
        for x in [183,370,566]:
            d.rectangle((x,239,x+52,303),fill=(54,43,34),outline=(102,72,44),width=3)
            d.rectangle((x+7,250,x+45,292),fill=(106,53,27))
            for xx in range(x+10,x+44,5):d.rectangle((xx,252,xx+2,289),fill=(220,127,47))
            d.rectangle((x+21,60,x+28,235),fill=(38,40,35));d.line((x+27,60,x+27,235),fill=(68,62,43))
    if name=='toxic':
        for x in [175,364,558]:
            d.rounded_rectangle((x,168,x+54,308),radius=16,fill=(24,48,44),outline=(51,77,61),width=2)
            d.rectangle((x+15,188,x+36,280),fill=(42,73,55));d.line((x+18,195,x+18,275),fill=(77,111,71),width=3)
            for y in range(194,275,11):d.line((x+32,y,x+36,y),fill=(134,151,91))
    # Light cones behind playfield.
    glow=Image.new('RGBA',im.size);g=ImageDraw.Draw(glow)
    for x in [47,229,507,695]:g.polygon([(x-6,114),(x+6,114),(x+66,322),(x-65,322)],fill=accent+(10,))
    im=Image.alpha_composite(im.convert('RGBA'),glow)
    # Restrained deterministic surface noise and rust.
    pix=im.load()
    for i in range(16000):
        x,y=R.randrange(w),R.randrange(h);r,g,b,a=pix[x,y];v=R.choice([-4,-3,-2,2,3]);pix[x,y]=(max(0,r+v),max(0,g+v),max(0,b+v),a)
    im.save(OUT/f'{name}-back.png',optimize=True)
    # Foreground has occasional framing pipes, no opaque layer over game pieces.
    fg=Image.new('RGBA',(w,h));f=ImageDraw.Draw(fg)
    f.rectangle((0,h-15,w,h),fill=(6,13,16));f.line((0,h-16,w,h-16),fill=(33,47,46),width=2)
    for x in range(-10,w,91):
        f.rectangle((x,h-12,x+64,h),fill=(12,23,26));f.line((x,h-12,x+64,h-12),fill=(40,49,43))
    f.line([(0,20),(120,43),(245,47),(399,25),(596,30),(768,48)],fill=(5,13,17),width=3)
    f.line([(0,22),(120,45),(245,49),(399,27),(596,32),(768,50)],fill=(26,41,43),width=1)
    fg.save(OUT/f'{name}-front.png',optimize=True)

STATES=['idle','move','rush','aim','shoot','burst','grenade_throw','melee','charge','hit','armour_hit','climb','descend','jump','landing','knockdown','stand','unconscious']
PALETTES={'hero':('#547e7a','#acc5b5','#e2c082'),'rifleman':('#6e6660','#a79983','#cf7b5a'),'assault':('#795a43','#b09768','#e8b45c'),'sniper':('#4a6264','#849691','#e2a466'),'heavy':('#656b5a','#a7aa83','#d6a464'),'specialist':('#60674b','#a2a279','#a7d491'),'commander':('#70544f','#ba9271','#efb881')}
def soldier(kind):
    sheet=Image.new('RGBA',(48*4,56*len(STATES)))
    body,hi,light=PALETTES[kind]
    for si,state in enumerate(STATES):
        for frame in range(4):
            im=Image.new('RGBA',(48,56));d=ImageDraw.Draw(im)
            bounce=1 if frame in [1,2] and state=='idle' else 0;dx=0;dy=bounce
            walk=state in ['move','rush','charge'];stride=[-3,0,3,0][frame] if walk else 0
            if state in ['jump','grenade_throw']:dy=-3 if frame in [1,2] else 0
            if state in ['hit','armour_hit']:dx=-2 if frame==1 else 0
            if state=='landing':dy=3 if frame<2 else 0
            def rect(box,fill):d.rectangle((box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy),fill=fill)
            # Boots and separated legs, pelvis and steel torso.
            if kind=='sniper':d.polygon([(18+dx,17+dy),(27+dx,18+dy),(30+dx,44+dy),(12+dx,46+dy)],fill='#293c3d')
            rect((17-stride,36,21-stride,47),'#27373a');rect((25+stride,36,29+stride,47),'#39494a')
            rect((15-stride,46,22-stride,49),'#15242a');rect((24+stride,46,32+stride,49),'#182a2e')
            rect((16,31,30,38),'#263a3c');rect((18,32,22,35),hi)
            if kind=='heavy':
                rect((10,19,35,33),'#253839');rect((12,20,34,31),body);rect((12,20,32,22),hi)
                rect((10,18,17,27),body);rect((30,18,36,27),hi);rect((13,24,32,29),'#3d4f4b')
                rect((10,35,17,43),body);rect((29,35,34,43),body)
            else:
                rect((16,20,30,33),body);rect((16,20,30,22),hi);rect((19,24,27,30),'#344749');rect((16,30,30,33),'#263737')
                rect((12,20,17,28),body);rect((13,20,17,22),hi)
            # Pack, straps and tiny metal details.
            rect((10,22,14,35),'#354747');rect((11,23,12,32),hi);rect((18,22,19,31),hi);rect((25,33,28,35),light)
            if kind=='specialist':rect((7,18,13,36),body);rect((7,19,13,22),hi);rect((9,23,10,32),light)
            # Head has recognisable closed visor, no borrowed insignia.
            rect((18,9,28,20),'#1d2d31');rect((17,9,28,13),body);rect((19,8,26,9),hi)
            rect((20,14,29,16),'#17272c');rect((23,14,29,15),light);rect((21,18,27,20),'#566760')
            if kind=='assault':rect((20,5,23,8),hi);rect((15,11,18,18),'#3c3430')
            if kind=='commander':rect((14,9,30,11),'#453e38');rect((17,6,27,9),body);rect((27,10,33,11),hi)
            if kind=='sniper':rect((15,8,19,19),body);rect((16,7,27,9),body)
            if kind=='specialist':rect((20,17,30,20),'#273b39');rect((28,18,31,22),hi)
            # Arms and weapon pose.
            raising=state=='grenade_throw'
            if raising:
                rect((28,13,31,25),body);rect((30,10,33,14),'#b1a384');rect((31,7,34,10),'#727957')
            elif state in ['climb','descend']:
                yy=13 if frame%2 else 23;rect((28,yy,31,30),body);rect((29,yy-2,32,yy),hi)
            elif state in ['melee','charge']:
                rect((28,23,38,26),body);rect((37,18 if frame==1 else 24,40,32),hi)
                d.line((39,14 if frame==1 else 24,45,4 if frame==1 else 17),fill='#c9cdb1',width=2)
            else:
                rect((27,23,34,27),body);rect((32,24,35,27),'#a9977a')
                barrel=46 if kind=='sniper' else 43 if kind=='heavy' else 41
                rect((26,23,barrel,26),'#122328');rect((29,22,barrel-3,23),'#7f8880');rect((30,26,33,31),'#202e30')
                if kind=='heavy':rect((32,23,43,29),'#3b4d4b');rect((33,22,42,23),hi)
                if kind=='sniper':rect((29,19,35,21),'#718f82')
                if state in ['shoot','burst'] and frame in [1,2]:
                    d.polygon([(barrel+1,21),(47,23),(barrel+1,29),(barrel+2,25)],fill='#e8d09b')
            if state in ['knockdown','unconscious']:
                im=im.rotate(90,expand=False,resample=Image.Resampling.NEAREST);im=Image.eval(im,lambda p:p)
                im2=Image.new('RGBA',im.size);im2.alpha_composite(im,(0,17));im=im2
            sheet.alpha_composite(im,(frame*48,si*56))
    sheet.save(OUT/f'{kind}.png',optimize=True)

EFFECTS=['muzzle','bullet','armour','blood','smoke','fire','toxic','acid','explosion','flash','break','status']
def effects():
    sheet=Image.new('RGBA',(32*6,32*len(EFFECTS)))
    for row,name in enumerate(EFFECTS):
        for frame in range(6):
            im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im)
            if name in ['smoke','toxic','fire','explosion','flash']:
                colors={'smoke':(134,150,145),'toxic':(142,171,82),'fire':(239,143,52),'explosion':(242,175,83),'flash':(241,236,199)}
                for i in range(16):
                    r=R.randrange(2,7);x=R.randrange(7,26);y=R.randrange(5,28)
                    if name=='fire':y=max(1,y-frame);r=R.randrange(1,5)
                    d.rectangle((x-r,y-r,x+r,y+r),fill=colors[name]+(R.randrange(60,170),))
            else:
                color={'muzzle':'#f5daa0','bullet':'#dac79b','armour':'#b4d4d0','blood':'#994c40','acid':'#acc456','break':'#d6b277','status':'#d9c890'}[name]
                for i in range(8):
                    theta=i*math.pi/4;r=2+frame*2;xx=16+int(math.cos(theta)*r);yy=16+int(math.sin(theta)*r);d.rectangle((xx,yy,xx+1,yy+2),fill=color)
            sheet.alpha_composite(im,(frame*32,row*32))
    sheet.save(OUT/'effects.png',optimize=True)

SOUNDS={'tap':(.07,850),'dice':(.17,550),'pistol':(.18,160),'smg':(.28,150),'rifle':(.25,90),'shotgun':(.35,68),'sniper':(.36,130),'repeater':(.5,60),'flame':(.6,60),'grenade':(.3,430),'explosion':(.8,42),'flash':(.4,1800),'blade':(.23,650),'hammer':(.4,75),'armour':(.3,990),'blood':(.2,200),'break':(.4,600),'footsteps':(.16,120),'climb':(.21,390),'jump':(.23,300),'landing':(.32,65),'fire':(.8,80),'gas':(.65,1200),'machinery':(.9,50)}
def wav(name,duration,freq):
    sr=22050;samples=[];rng=random.Random(88+len(name))
    for i in range(int(duration*sr)):
        t=i/sr;p=t/duration;env=(1-p)**(3 if name not in ['flame','gas','fire'] else .7)
        noise=rng.uniform(-1,1);tone=math.sin(2*math.pi*freq*t*(1-p*.3))
        mix=.7*noise+.3*tone if name not in ['tap','dice','flash'] else .25*noise+.75*tone
        if name in ['smg','repeater']:env*=.4+.6*(math.sin(t*2*math.pi*16)>0)
        samples.append(int(13500*env*mix))
    with wave.open(str(OUT/f'{name}.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(struct.pack('<'+'h'*len(samples),*samples))

for name,accent in [('terminal',(198,174,118)),('foundry',(215,131,64)),('toxic',(151,181,116))]:background(name,accent)
for name in PALETTES:soldier(name)
effects()
for name,(dur,freq) in SOUNDS.items():wav(name,dur,freq)
# Seamlessly periodic industrial hum, attenuated independently in game.
sr=22050;n=sr*4
samples=[int(1800*(math.sin(2*math.pi*50*i/sr)+.3*math.sin(2*math.pi*83*i/sr)+.2*math.sin(2*math.pi*125*i/sr))*(.8+.2*math.sin(2*math.pi*.5*i/sr))) for i in range(n)]
with wave.open(str(OUT/'ambience.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(struct.pack('<'+'h'*n,*samples))
(OUT/'manifest.json').write_text(json.dumps({'source':'Original procedural artwork and sound; scripts/generate_assets.py','seed':4173,'states':STATES,'effects':EFFECTS,'sounds':list(SOUNDS),'sprite':{'width':48,'height':56,'framesPerState':4}},ensure_ascii=False,indent=2))
print(f'Generated {len(list(OUT.iterdir()))} local assets.')
