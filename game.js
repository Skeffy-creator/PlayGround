(() => {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const TILE_W = 64, TILE_H = 32, MAP_SIZE = 42;
  const CLASSES = {
    Warrior: {str:8,dex:5,vit:8,int:2,mag:2,hp:120,mp:30,power:16,weapon:'Iron sword'},
    Wizard: {str:2,dex:5,vit:4,int:8,mag:9,hp:78,mp:105,power:8,weapon:'Oak staff'},
    Battlemage: {str:5,dex:5,vit:6,int:6,mag:6,hp:98,mp:68,power:12,weapon:'Runed staff'}
  };
  const ITEMS = {
    'Iron sword': {icon:'⚔',type:'weapon',power:5}, 'Oak staff': {icon:'ϟ',type:'weapon',power:3},
    'Runed staff': {icon:'♜',type:'weapon',power:4}, 'Short bow': {icon:'⌁',type:'weapon',power:6},
    'Leather armor': {icon:'▰',type:'armor',armor:2}, 'Minor health tonic': {icon:'⚗',type:'consumable'},
    'Goblin ear': {icon:'♧',type:'quest'}, 'Copper ring': {icon:'◉',type:'ring',magic:1},
    'Moonstone charm': {icon:'✧',type:'ring',magic:3,rare:true}, 'Mossy cap': {icon:'♧',type:'armor',armor:3,rare:true},
    'Emberwood bow': {icon:'⌁',type:'weapon',power:8,rare:true}
  };
  const FACTION_COLOR = {Aresden:'#b65e49',Elvine:'#748bab'};
  const state = {
    name:'Aethra',faction:'Aresden',className:'Battlemage',level:1,xp:0,gold:25,hp:98,mp:68,
    x:15,y:15,stats:{str:5,dex:5,vit:6,int:6,mag:6},skills:{Melee:1,Archery:1,Magic:1,Defense:1},
    inventory:['Runed staff','Leather armor','Minor health tonic','Minor health tonic'],equipment:{weapon:'Runed staff',armor:'Leather armor',ring:null},potions:2,
    quest:'talk',questKills:0,kills:0,target:null,walkTo:null,pendingNpc:null,attackCooldown:0,
    enemies:[],floating:[],keys:new Set(),modal:false,selectedFaction:'Aresden',selectedClass:'Battlemage',
    lastSave:0,weather:'FAIR SKIES',clock:0
  };
  const NPCS = [
    {x:14,y:12,name:'Captain Rowan',kind:'guard'},
    {x:11,y:16,name:'Mira the Trader',kind:'merchant'},
    {x:17,y:12,name:'Sister Elowen',kind:'healer'}
  ];
  const rand = (x,y,n=0) => {const a=Math.sin(x*127.1+y*311.7+n*74.7)*43758.5453;return a-Math.floor(a);};
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const maxHp = () => (CLASSES[state.className]?.hp||98)+(state.level-1)*12;
  const maxMp = () => (CLASSES[state.className]?.mp||68)+(state.level-1)*9;
  function say(text,type=''){const rail=$('toastRail'),el=document.createElement('div');el.className=`game-toast ${type}`;el.textContent=text;rail.appendChild(el);setTimeout(()=>el.remove(),2400);}
  function floatText(x,y,text,color='#f2d89e'){state.floating.push({x,y,text,color,life:1});}
  function spawnEnemies(){
    const placements=[[21,14,'Goblin Scout'],[23,17,'Goblin Scout'],[21,21,'Meadow Wolf'],[26,15,'Goblin Scout'],[25,22,'Meadow Wolf'],[19,23,'Green Slime'],[29,19,'Goblin Scout']];
    state.enemies=placements.map(([x,y,type],id)=>({id,x,y,type,alive:true,hp:type==='Meadow Wolf'?50:type==='Green Slime'?34:40,maxHp:type==='Meadow Wolf'?50:type==='Green Slime'?34:40,respawn:0,attack:0,aggro:false}));
  }
  spawnEnemies();
  function save(){try{localStorage.setItem('emberfall-save',JSON.stringify({name:state.name,faction:state.faction,className:state.className,level:state.level,xp:state.xp,gold:state.gold,hp:state.hp,mp:state.mp,stats:state.stats,skills:state.skills,inventory:state.inventory,equipment:state.equipment,potions:state.potions,quest:state.quest,questKills:state.questKills,kills:state.kills,x:state.x,y:state.y}));}catch(_){}}
  function load(){try{const d=JSON.parse(localStorage.getItem('emberfall-save'));if(!d)return false;Object.assign(state,d);state.selectedClass=state.className;state.selectedFaction=state.faction;state.hp=Math.min(state.hp,maxHp());state.mp=Math.min(state.mp,maxMp());return true;}catch(_){return false;}}
  function updateHud(){
    $('characterName').textContent=state.name;$('factionLabel').textContent=state.faction.toUpperCase();$('className').textContent=state.className;$('level').textContent=state.level;
    $('hpText').textContent=`${Math.ceil(state.hp)} / ${maxHp()}`;$('hpBar').style.width=`${Math.max(0,state.hp/maxHp()*100)}%`;
    $('mpText').textContent=`${Math.ceil(state.mp)} / ${maxMp()}`;$('mpBar').style.width=`${Math.max(0,state.mp/maxMp()*100)}%`;
    $('xpText').textContent=`${state.xp} / ${state.level*100}`;$('xpBar').style.width=`${Math.min(100,state.xp/(state.level*100)*100)}%`;$('gold').textContent=state.gold;$('potionCount').textContent=state.potions;
    $('portrait').style.background=`linear-gradient(145deg,${FACTION_COLOR[state.faction]}99,#353a2d 54%,#22251f)`;
    const meadow=state.x>19;$('zoneName').textContent=`${state.faction.toUpperCase()} · ${meadow?'WHISPERING MEADOW':'HAVEN'}`;
    $('locationTitle').textContent=meadow?'WHISPERING MEADOW':"HAVEN'S REST";$('locationSub').textContent=meadow?`${state.faction} · Eastern Frontier`:`${state.faction} · Frontier Province`;$('mapLabel').textContent=meadow?'Whispering Meadow':"Haven's meadow";
    $('coordinates').innerHTML=`${Math.floor(state.x)}, ${Math.floor(state.y)} <span>·</span> ${meadow?'MEADOW':'HAVEN'}`;
    $('questTitle').textContent=state.quest==='talk'?'A Favor for the Guard':state.quest==='hunt'?'The Meadow Watch':'A Friend to Haven';
    $('questText').textContent=state.quest==='talk'?'Speak with Captain Rowan near the town well. The frontier has grown restless.':state.quest==='hunt'?`Thin the goblin scouts in Whispering Meadow. Return to Captain Rowan. (${state.questKills}/3)`:'Captain Rowan thanks you for keeping the meadow road safe. Your name is known in Haven.';
    $('questProgressText').textContent=state.quest==='talk'?'0 / 1':state.quest==='hunt'?`${state.questKills} / 3`:'COMPLETE';$('questProgressBar').style.width=state.quest==='talk'?'0%':state.quest==='hunt'?`${state.questKills/3*100}%`:'100%';
    const t=state.target?.alive?state.target:null;$('targetCard').classList.toggle('hidden',!t);if(t){$('targetName').textContent=t.type;$('targetLevel').textContent=`Lv. ${t.type==='Meadow Wolf'?2:1} · Hostile`;$('targetIcon').textContent=t.type==='Meadow Wolf'?'♞':t.type==='Green Slime'?'●':'♟';$('targetHealth').style.width=`${Math.max(0,t.hp/t.maxHp*100)}%`;}
  }

  /* WORLD RENDERING */
  let view={w:800,h:600,dpr:1,cx:0,cy:0};
  function resize(){
    const r=canvas.getBoundingClientRect();view.dpr=Math.min(devicePixelRatio||1,2);view.w=r.width;view.h=r.height;
    canvas.width=Math.max(1,Math.floor(r.width*view.dpr));canvas.height=Math.max(1,Math.floor(r.height*view.dpr));ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
  }
  function project(x,y){return {x:view.w/2+(x-y)*TILE_W/2-view.cx,y:view.h/2+(x+y)*TILE_H/2-view.cy};}
  function pathDiamond(x,y){ctx.beginPath();ctx.moveTo(x,y-TILE_H/2);ctx.lineTo(x+TILE_W/2,y);ctx.lineTo(x,y+TILE_H/2);ctx.lineTo(x-TILE_W/2,y);ctx.closePath();}
  function tileAt(x,y){
    const p=project(x,y);let c;
    if(x>=10&&x<=18&&y>=10&&y<=18)c='#6d7451';else c='#66774c';
    if((x>19&&x<31&&y>11&&y<25)&&rand(x,y,3)>.81)c='#71804c';
    if(rand(x,y,1)>.91)c='#727b50';if(rand(x,y,2)>.92)c='#596d48';
    pathDiamond(p.x,p.y);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='rgba(35,47,31,.18)';ctx.lineWidth=.6;ctx.stroke();
    if(rand(x,y,5)>.96){ctx.fillStyle='#d5bc79';ctx.globalAlpha=.55;ctx.fillRect(p.x-1,p.y-2,2,2);ctx.globalAlpha=1;}
  }
  function drawTree(x,y,large=false){
    const p=project(x,y),size=large?1.28:1;ctx.fillStyle='#433b2b';ctx.fillRect(p.x-3,p.y-18*size,6,20*size);
    for(let i=0;i<3;i++){ctx.fillStyle=['#354b34','#40583a','#506642'][i];ctx.beginPath();ctx.moveTo(p.x,p.y-(55-i*10)*size);ctx.lineTo(p.x-17*size+i*2,p.y-(27-i*6)*size);ctx.lineTo(p.x+18*size-i*2,p.y-(27-i*6)*size);ctx.closePath();ctx.fill();}
    ctx.fillStyle='rgba(20,25,17,.2)';ctx.beginPath();ctx.ellipse(p.x+5,p.y+2,15*size,5,0,0,Math.PI*2);ctx.fill();
  }
  function drawBuilding(x,y,w,h,label,roof='#75493b'){
    const p=project(x,y), bw=w*TILE_W/2,bh=h*TILE_H/2;
    ctx.fillStyle='#4b3b2e';ctx.fillRect(p.x-bw/2,p.y-bh-28,bw,bh+28);
    ctx.fillStyle='#826c4f';ctx.fillRect(p.x-bw/2+4,p.y-bh-24,bw-8,bh+24);
    ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(p.x-bw/2-5,p.y-bh-23);ctx.lineTo(p.x,p.y-bh-48);ctx.lineTo(p.x+bw/2+5,p.y-bh-23);ctx.closePath();ctx.fill();
    ctx.fillStyle='#46362b';ctx.fillRect(p.x-6,p.y-24,12,24);ctx.fillStyle='#bd9d5a';ctx.fillRect(p.x+2,p.y-13,2,3);
    if(label){ctx.fillStyle='#e6d9b4';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(label,p.x,p.y-bh-52);}
  }
  function drawEntity(e,isNpc=false){
    const p=project(e.x,e.y);ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle='rgba(20,24,17,.34)';ctx.beginPath();ctx.ellipse(0,0,11,4,0,0,Math.PI*2);ctx.fill();
    if(isNpc){ctx.fillStyle=e.kind==='guard'?'#9a493b':e.kind==='merchant'?'#8f794b':'#d0c39b';ctx.fillRect(-6,-24,12,16);ctx.fillStyle='#d9b893';ctx.beginPath();ctx.arc(0,-29,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#524d3d';ctx.fillRect(-7,-22,14,3);}
    else {const col=e.type==='Meadow Wolf'?'#847a5e':e.type==='Green Slime'?'#91a45b':'#71804a';ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(0,-12,e.type==='Meadow Wolf'?11:9,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d9c99c';ctx.beginPath();ctx.arc(-3,-15,1.3,0,Math.PI*2);ctx.arc(3,-15,1.3,0,Math.PI*2);ctx.fill();if(state.target===e){ctx.strokeStyle='#e2bc6f';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,14,6,0,0,Math.PI*2);ctx.stroke();}}
    ctx.restore();
  }
  function drawPlayer(){
    const p=project(state.x,state.y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(10,13,9,.4)';ctx.beginPath();ctx.ellipse(0,0,12,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=FACTION_COLOR[state.faction];ctx.fillRect(-7,-26,14,18);ctx.fillStyle='#d6b795';ctx.beginPath();ctx.arc(0,-31,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d0b266';ctx.fillRect(-8,-27,16,3);ctx.fillStyle='#473d2d';ctx.fillRect(-5,-9,4,9);ctx.fillRect(2,-9,4,9);
    ctx.fillStyle='#f0dfa9';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(state.name,0,-43);ctx.restore();
  }
  function render(){
    if(!view.w)resize();view.cx=(state.x-state.y)*TILE_W/2;view.cy=(state.x+state.y)*TILE_H/2;
    ctx.clearRect(0,0,view.w,view.h);const sky=ctx.createLinearGradient(0,0,0,view.h);sky.addColorStop(0,'#85946b');sky.addColorStop(.58,'#78865b');sky.addColorStop(1,'#515e43');ctx.fillStyle=sky;ctx.fillRect(0,0,view.w,view.h);
    for(let sum=0;sum<MAP_SIZE*2;sum++)for(let x=0;x<MAP_SIZE;x++){const y=sum-x;if(y>=0&&y<MAP_SIZE)tileAt(x,y);}
    drawBuilding(12,13,3,2,'HALL OF HAVEN','#795043');drawBuilding(16,16,2,2,'','#8b7047');
    for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++)if(rand(x,y,11)>.982&&Math.hypot(x-state.x,y-state.y)>3&&(x<9||x>31||y<8||y>30))drawTree(x,y,rand(x,y,14)>.7);
    const actors=[...NPCS.map(n=>({...n,npc:true})),...state.enemies.filter(e=>e.alive)];actors.sort((a,b)=>a.x+a.y-b.x-b.y).forEach(a=>drawEntity(a,a.npc));drawPlayer();
    for(const f of state.floating){const p=project(f.x,f.y);ctx.globalAlpha=Math.max(0,f.life);ctx.fillStyle=f.color;ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText(f.text,p.x,p.y-28-(1-f.life)*22);ctx.globalAlpha=1;}
  }

  /* GAME RULES */
  function gainXp(amount){state.xp+=amount;while(state.xp>=state.level*100){state.xp-=state.level*100;state.level++;state.stats.vit++;state.stats.str++;state.hp=maxHp();state.mp=maxMp();say(`Level ${state.level} reached! Your strength grows.`,'good');}updateHud();save();}
  function addItem(item){state.inventory.push(item);if(item==='Minor health tonic')state.potions++;say(`${item} added to your bag.`,'good');updateHud();save();}
  function attack(spell=false){
    const e=state.target?.alive?state.target:state.enemies.filter(v=>v.alive&&dist(v,state)<3).sort((a,b)=>dist(a,state)-dist(b,state))[0];
    if(!e){say('No foe is close enough.');return;}state.target=e;
    if(spell){if(state.mp<12){say('Not enough mana.');return;}state.mp-=12;}
    const base=CLASSES[state.className].power+(ITEMS[state.equipment.weapon]?.power||0)+(spell?state.stats.mag*1.7:state.stats.str*.55);
    const damage=Math.round(base*(.8+Math.random()*.45));e.hp-=damage;e.aggro=true;floatText(e.x,e.y,`-${damage}`,spell?'#a9d8e6':'#f1d38c');state.attackCooldown=.36;
    if(e.hp<=0){e.alive=false;e.respawn=18;state.kills++;state.gold+=5+Math.floor(Math.random()*8);say(`${e.type} defeated · +${e.type==='Meadow Wolf'?35:25} XP`,'good');gainXp(e.type==='Meadow Wolf'?35:25);
      if(e.type==='Goblin Scout'&&state.quest==='hunt'){state.questKills=Math.min(3,state.questKills+1);if(state.questKills>=3)say('The meadow is safer. Return to Captain Rowan.','good');}
      if(Math.random()<.3)addItem(Math.random()<.18?'Copper ring':'Minor health tonic');if(Math.random()<.04)addItem('Moonstone charm');state.target=null;
    }updateHud();
  }
  function usePotion(index=-1){if(state.potions<1){say('You have no health tonics.');return;}if(state.hp>=maxHp()){say('Your health is already full.');return;}state.potions--;if(index>=0)state.inventory.splice(index,1);else{const bagIndex=state.inventory.indexOf('Minor health tonic');if(bagIndex>=0)state.inventory.splice(bagIndex,1);}state.hp=Math.min(maxHp(),state.hp+48);floatText(state.x,state.y,'+48','#a7d27b');say('You drink a minor health tonic.','good');updateHud();save();}
  function castHeal(){if(state.mp<16){say('Not enough mana.');return;}state.mp-=16;state.hp=Math.min(maxHp(),state.hp+35);floatText(state.x,state.y,'+35','#9ce0a2');say('Mend restores your vitality.','good');updateHud();}
  function nearestNpc(){return NPCS.filter(n=>dist(n,state)<2.4).sort((a,b)=>dist(a,state)-dist(b,state))[0];}
  function interact(npc=nearestNpc()){
    if(!npc){say('No one is close enough to speak with.');return;}
    if(npc.kind==='guard'){
      if(state.quest==='talk'){state.quest='hunt';openDialog('Captain Rowan','The meadow road is plagued by goblin scouts. Defeat three of them and report back. You have my thanks, '+state.name+'.',[['Accept the task','closeDialog']]);}
      else if(state.quest==='hunt'&&state.questKills>=3){state.quest='done';state.gold+=75;addItem('Mossy cap');gainXp(80);openDialog('Captain Rowan','Fine work. The eastern road is safe again. Take these crowns and this cap as a token of Haven’s gratitude.',[['Thank you','closeDialog']]);}
      else openDialog('Captain Rowan',state.quest==='hunt'?`The meadow still needs your help. Goblins defeated: ${state.questKills}/3.`:'The folk of Haven remember your courage. Keep your blade ready.',[['Understood','closeDialog']]);
    }else if(npc.kind==='merchant')openDialog('Mira the Trader','A fair price for a fair traveler. Choose what you need.',[['Health tonic · 18 crowns',()=>buyItem('Minor health tonic',18)],['Copper ring · 35 crowns',()=>buyItem('Copper ring',35)],['Short bow · 45 crowns',()=>buyItem('Short bow',45)],['Leave','closeDialog']]);
    else openDialog('Sister Elowen','Rest here, traveler. I can mend your wounds and restore your spirit.',[['Receive healing · 10 crowns',healAtInn],['Leave','closeDialog']]);
    updateHud();
  }
  function healAtInn(){if(state.gold<10){say('You need 10 crowns.');return;}state.gold-=10;state.hp=maxHp();state.mp=maxMp();say('You feel restored.','good');closeDialog();updateHud();save();}
  function buyItem(item,cost){if(state.gold<cost){say('You do not have enough crowns.');return;}state.gold-=cost;addItem(item);closeDialog();}
  function moveToward(x,y,dt){const dx=x-state.x,dy=y-state.y,d=Math.hypot(dx,dy);if(d<.08){state.x=x;state.y=y;state.walkTo=null;return;}const speed=3.15*dt;const nx=state.x+dx/d*Math.min(speed,d),ny=state.y+dy/d*Math.min(speed,d);if(nx<2||ny<2||nx>39||ny>39)return;state.x=nx;state.y=ny;}
  function update(dt){
    if(!state.modal){let dx=0,dy=0;if(state.keys.has('w')||state.keys.has('arrowup'))dy--;if(state.keys.has('s')||state.keys.has('arrowdown'))dy++;if(state.keys.has('a')||state.keys.has('arrowleft'))dx--;if(state.keys.has('d')||state.keys.has('arrowright'))dx++;
      if(dx||dy){const l=Math.hypot(dx,dy);state.x=Math.max(2,Math.min(39,state.x+dx/l*3.1*dt));state.y=Math.max(2,Math.min(39,state.y+dy/l*3.1*dt));state.walkTo=null;}else if(state.walkTo)moveToward(state.walkTo.x,state.walkTo.y,dt);
      if(state.pendingNpc&&dist(state.pendingNpc,state)<2.2){const n=state.pendingNpc;state.pendingNpc=null;interact(n);}
    }
    state.attackCooldown=Math.max(0,state.attackCooldown-dt);
    if(!state.modal&&state.target?.alive&&dist(state.target,state)<2.15&&state.attackCooldown<=0)attack(false);
    for(const e of state.enemies){if(!e.alive){e.respawn-=dt;if(e.respawn<=0){e.alive=true;e.hp=e.maxHp;e.aggro=false;}continue;}
      if(state.x>19&&dist(e,state)<5){e.aggro=true;if(dist(e,state)>1.3)moveEntityToward(e,state,dt*0.36);else{e.attack-=dt;if(e.attack<=0){const armor=ITEMS[state.equipment.armor]?.armor||0;const hit=Math.max(2,(e.type==='Meadow Wolf'?9:6)-armor);state.hp-=hit;e.attack=1.5;floatText(state.x,state.y,`-${hit}`,'#ed8980');if(state.hp<=0){state.hp=maxHp()*.55;state.mp=maxMp()*.5;state.x=15;state.y=15;state.gold=Math.max(0,state.gold-8);state.target=null;say('You awaken at Haven’s shrine. 8 crowns were lost.','bad');}}}}
    }
    for(const f of state.floating)f.life-=dt;state.floating=state.floating.filter(f=>f.life>0);state.clock+=dt;
    if(state.clock>1){state.clock=0;const mins=Math.floor(performance.now()/4000)%1440; $('worldClock').textContent=`DAY 01 · ${String(8+Math.floor(mins/60)%12).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
    updateHud();if(Date.now()-state.lastSave>12000){state.lastSave=Date.now();save();}
  }
  function moveEntityToward(e,target,dt){const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*dt;e.y+=dy/d*dt;}

  /* WINDOWS AND INVENTORY */
  let modalActions={};
  function showModal(title,body,buttons=[]){
    const modal=$('modal');modalActions={};modal.innerHTML=`<button class="modal-x" data-action="closeDialog" aria-label="Close">×</button><div class="eyebrow">EMBERFALL · HAVEN</div><h2>${title}</h2><div class="modal-body">${body}</div><div class="modal-actions">${buttons.map(([label,action],i)=>{const key=`act${i}`;modalActions[key]=action;return `<button class="modal-action" data-action="${key}">${label}</button>`;}).join('')}</div>`;
    $('modalBackdrop').classList.remove('hidden');state.modal=true;
  }
  function openDialog(title,text,choices=[]){showModal(title,`<p>${text}</p>`,choices);}
  function closeDialog(){$('modalBackdrop').classList.add('hidden');state.modal=false;}
  function openInventory(){
    const equipment=Object.entries(state.equipment).map(([slot,item])=>`<div class="equip-row"><b>${slot.toUpperCase()}</b><span>${item||'— empty —'}</span></div>`).join('');
    const bag=state.inventory.length?state.inventory.map((item,i)=>{const d=ITEMS[item]||{};return `<div class="bag-item"><span class="bag-icon">${d.icon||'◇'}</span><div><b>${item}</b><small>${d.rare?'Rare · ':''}${d.type||'item'}</small></div><button class="modal-action" data-action="equip${i}">${d.type==='consumable'?'USE':d.type==='quest'?'—':'EQUIP'}</button></div>`;}).join(''):'<p>Your bag is empty.</p>';
    const choices=[['Close','closeDialog']];state.inventory.forEach((item,i)=>{modalActions[`equip${i}`]=()=>itemAction(i);});
    showModal('Traveler’s Bag',`<div class="inventory-layout"><div><h3>Equipment</h3>${equipment}<h3>Satchel · ${state.inventory.length}/24</h3><div class="bag-list">${bag}</div></div><div class="bag-note">Crowns <b>${state.gold}</b><p>Items found on your journey are kept here. Select EQUIP to change your gear.</p></div></div>`,choices);
    state.inventory.forEach((item,i)=>{modalActions[`equip${i}`]=()=>itemAction(i);});
  }
  function itemAction(index){const item=state.inventory[index],d=ITEMS[item];if(!item||!d)return;
    if(d.type==='consumable'){usePotion(index);openInventory();return;}
    if(d.type==='weapon'||d.type==='armor'||d.type==='ring'){const slot=d.type==='weapon'?'weapon':d.type==='armor'?'armor':'ring';const prev=state.equipment[slot];state.equipment[slot]=item;state.inventory.splice(index,1);if(prev)state.inventory.push(prev);say(`${item} equipped.`,'good');updateHud();save();openInventory();}
  }
  function openCharacter(){const s=state.stats,skills=state.skills;showModal('Character & Attributes',`<p>Level ${state.level} ${state.className} of ${state.faction}. You have ${state.kills} victories and ${state.gold} crowns.</p><div class="stat-grid">${[['Strength',s.str],['Dexterity',s.dex],['Vitality',s.vit],['Intelligence',s.int],['Magic',s.mag],['Melee',skills.Melee],['Archery',skills.Archery],['Magic skill',skills.Magic],['Defense',skills.Defense]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>`,[['Open bag','openInventory'],['Close','closeDialog']]);}
  function openSkills(){showModal('Arts of the Realms',`<div class="skill-card"><b>⚔ Melee</b><p>Close-range weapon strikes. Scales with Strength and equipped weapon.</p><small>RANK ${state.skills.Melee}</small></div><div class="skill-card"><b>✹ Ember Bolt · 12 mana</b><p>Hurl a shard of flame at your selected foe. Press 1.</p><small>MAGIC RANK ${state.skills.Magic}</small></div><div class="skill-card"><b>✚ Mend · 16 mana</b><p>Restore 35 health. Press 2.</p><small>MAGIC RANK ${state.skills.Magic}</small></div>`,[['Close','closeDialog']]);}
  function openMap(){showModal('Frontier Map',`<div class="map-panel"><div class="map-block town">HAVEN’S REST</div><div class="map-road">◆ EASTERN ROAD ◆</div><div class="map-block meadow">WHISPERING MEADOW<br><small>Goblins · wolves · old stones</small></div><p>You are at <b>${state.x>19?'Whispering Meadow':'Haven’s Rest'}</b> · ${Math.floor(state.x)}, ${Math.floor(state.y)}</p></div>`,[['Close','closeDialog']]);}
  function openJournal(){showModal('Field Journal',`<div class="quest-kicker">FIRST STEPS · MAIN QUEST</div><h3>${state.quest==='talk'?'A Favor for the Guard':state.quest==='hunt'?'The Meadow Watch':'A Friend to Haven'}</h3><p>${state.quest==='talk'?'Speak with Captain Rowan near the town well.':state.quest==='hunt'?`Defeat 3 goblin scouts · ${state.questKills}/3`:'Complete. The eastern road is safe, and the people of Haven are grateful.'}</p><div class="quest-track"><i style="width:${state.quest==='talk'?0:state.quest==='hunt'?state.questKills/3*100:100}%"></i></div>`,[['Close','closeDialog']]);}
  function openCharacterCreation(){
    const html=`<label class="form-label">Character name<input id="createName" maxlength="16" value="${state.name.replace(/[&<>"']/g,'')}" placeholder="Name"></label><div class="choice-row"><label>Realm<select id="createFaction"><option>Aresden</option><option>Elvine</option></select></label><label>Calling<select id="createClass"><option>Warrior</option><option>Wizard</option><option>Battlemage</option></select></label></div><p class="muted-copy">Warrior: resilient melee fighter · Wizard: powerful magic · Battlemage: balanced steel and sorcery.</p>`;
    showModal('Create Your Hero',html,[['Begin Journey','newCharacter'],['Cancel','closeDialog']]);$('createFaction').value=state.faction;$('createClass').value=state.className;
  }
  function newCharacter(){const name=$('createName').value.trim();if(!name){say('Choose a name for your hero.');return;}state.name=name;state.faction=$('createFaction').value;state.className=$('createClass').value;state.stats={...CLASSES[state.className]};state.skills={Melee:1,Archery:1,Magic:1,Defense:1};state.level=1;state.xp=0;state.gold=25;state.hp=maxHp();state.mp=maxMp();state.x=15;state.y=15;state.quest='talk';state.questKills=0;state.kills=0;state.potions=2;state.inventory=[CLASSES[state.className].weapon,'Leather armor','Minor health tonic','Minor health tonic'];state.equipment={weapon:CLASSES[state.className].weapon,armor:'Leather armor',ring:null};state.target=null;spawnEnemies();closeDialog();updateHud();save();say('Your journey begins, '+state.name+'.','good');}
  function menu(){showModal('Emberfall',`<p>Realms at War · Offline Chronicle</p><p>Your progress is saved on this device.</p>`,[['Character','openCharacter'],['Save now','saveNow'],['New character','openCharacterCreation'],['Close','closeDialog']]);}
  function saveNow(){save();say('Chronicle saved.','good');closeDialog();}

  function dispatch(action){
    const table={closeDialog,openInventory,openCharacter,openSkills,openMap,openJournal,openCharacterCreation,newCharacter,saveNow,menu,rest:()=>{state.hp=maxHp();state.mp=maxMp();say('You rest and recover.','good');updateHud();save();},attack:()=>attack(false),spell:()=>attack(true),heal:castHeal,potion:usePotion};
    if(typeof action==='function'){action();return;}if(table[action])table[action]();
  }
  function canvasClick(ev){
    const r=canvas.getBoundingClientRect(),px=ev.clientX-r.left,py=ev.clientY-r.top;
    const sx=(px-view.w/2+view.cx)*2/TILE_W,sy=(py-view.h/2+view.cy)*2/TILE_H,x=(sx+sy)/2,y=(sy-sx)/2;
    let nearest=null,best=Infinity;
    for(const n of NPCS){const p=project(n.x,n.y),d=Math.hypot(px-p.x,py-p.y);if(d<27&&d<best){nearest=n;best=d;}}
    for(const e of state.enemies.filter(v=>v.alive)){const p=project(e.x,e.y),d=Math.hypot(px-p.x,py-p.y);if(d<25&&d<best){nearest=e;best=d;}}
    if(nearest?.kind){state.pendingNpc=nearest;state.walkTo={x:nearest.x,y:nearest.y};if(dist(nearest,state)<2.4){state.walkTo=null;interact(nearest);}return;}
    if(nearest){state.target=nearest;if(dist(nearest,state)<2.5){state.walkTo=null;attack(false);}else{const d=dist(nearest,state);state.walkTo={x:nearest.x+(state.x-nearest.x)/d*1.35,y:nearest.y+(state.y-nearest.y)/d*1.35};}updateHud();return;}
    state.target=null;state.pendingNpc=null;state.walkTo={x:Math.max(2,Math.min(39,x)),y:Math.max(2,Math.min(39,y))};
  }
  function frame(now){const dt=Math.min(.05,(now-(frame.last||now))/1000);frame.last=now;update(dt);render();requestAnimationFrame(frame);}
  function init(){
    if(load())say(`Welcome back, ${state.name}.`,'good');resize();updateHud();
    window.addEventListener('resize',resize);canvas.addEventListener('click',canvasClick);
    document.addEventListener('keydown',ev=>{const key=ev.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))ev.preventDefault();if(state.modal){if(key==='escape')closeDialog();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){state.keys.add(key);return;}if(key===' '||key==='q')attack(false);else if(key==='1')attack(true);else if(key==='2')castHeal();else if(key==='3')usePotion();else if(key==='e')interact();else if(key==='i')openInventory();else if(key==='c')openCharacter();else if(key==='k')openSkills();else if(key==='m')openMap();});
    document.addEventListener('keyup',ev=>state.keys.delete(ev.key.toLowerCase()));window.addEventListener('blur',()=>state.keys.clear());
    $('modal').addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const key=b.dataset.action;if(key in modalActions)dispatch(modalActions[key]);else dispatch(key);});
    $('modalBackdrop').addEventListener('click',ev=>{if(ev.target===$('modalBackdrop'))closeDialog();});
    $('weaponSlot').addEventListener('click',()=>attack(false));$('spellSlot').addEventListener('click',()=>attack(true));$('healSlot').addEventListener('click',castHeal);$('potionSlot').addEventListener('click',usePotion);
    $('restBtn').addEventListener('click',()=>dispatch('rest'));$('menuBtn').addEventListener('click',menu);$('helpBtn').addEventListener('click',()=>showModal('Wayfarer’s Guide',`<p><b>Move:</b> WASD or arrow keys. You may also click the ground to travel.</p><p><b>Combat:</b> Select a foe and press SPACE/Q to strike. Press 1 for Ember Bolt, 2 to mend, and 3 to drink a tonic.</p><p><b>Interact:</b> Walk near a person and press E, or click them. Visit Mira to trade and Sister Elowen to heal.</p><p><b>Journal:</b> Complete Captain Rowan’s task to earn crowns, gear, and experience.</p>`,[['Understood','closeDialog']]));$('soundBtn').addEventListener('click',()=>say('The meadow wind stirs softly.'));
    $('editProfile').addEventListener('click',openCharacterCreation);$('journalBtn').addEventListener('click',openJournal);$('targetClose').addEventListener('click',()=>{state.target=null;updateHud();});
    document.querySelectorAll('.nav-tile').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-tile').forEach(v=>v.classList.remove('active'));btn.classList.add('active');dispatch(({inventory:'openInventory',character:'openCharacter',skills:'openSkills',map:'openMap'})[btn.dataset.tab]);}));
    requestAnimationFrame(frame);
  }
  init();
})();
