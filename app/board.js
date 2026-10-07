const attackers = `Striker,Sledge,Thatcher,Ash,Thermite,Twitch,Montagne,Glaz,Fuze,Blitz,IQ,Buck,Blackbeard,Capitao,Hibana,Jackal,Ying,Zofia,Dokkaebi,Lion,Finka,Maverick,Nomad,Gridlock,Nokk,Amaru,Kali,Iana,Ace,Zero,Flores,Osa,Sens,Grim,Brava,Ram,Deimos,Rauora,Solid Snake,Denari`.split(',');
const defenders = `Sentry,Smoke,Mute,Castle,Pulse,Doc,Rook,Kapkan,Tachanka,Jager,Bandit,Frost,Valkyrie,Caveira,Echo,Mira,Lesion,Ela,Vigil,Maestro,Alibi,Clash,Kaid,Mozzie,Warden,Goyo,Wamai,Oryx,Melusi,Aruni,Thunderbird,Thorn,Azami,Solis,Fenrir,Tubarao,Skopos`.split(',');
const iconId = n => ({'Capitao':'capitao','Nokk':'nokk','Tubarão':'tubarao','Solid Snake':'solid-snake'}[n] || n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll(' ','_'));
const asModel = n => ({'Capitao':'CAPITAO','Nokk':'NOKK','Tubarão':'TUBARAO','Solid Snake':'SOLID_SNAKE'}[n] || n.toUpperCase().replaceAll(' ','_').replaceAll('ö','O'));
const modelPath='model/model.json';
const state={Attack:[],Defense:[],banned:new Set(),model:null,dragOp:null};
const $=id=>document.getElementById(id);
const imageUrl=op=>`https://unpkg.com/r6operators@latest/dist/icons/${iconId(op)}.svg`;
const fallbackIcon=`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#253744" stroke="#62d4d3" stroke-width="2" d="M8 8h48v48H8z"/><path fill="#cbd8df" d="M32 13c-8 0-13 6-13 14v5l-5 8v4h10l3 8h10l3-8h10v-4l-5-8v-5c0-8-5-14-13-14z"/><path fill="#253744" d="M24 29h5v3h-5zm11 0h5v3h-5zM28 39h8v2h-8z"/></svg>')}`;
function togglePick(op, side) {
  const picked = state[side].includes(op);
  if (!picked && state[side].length >= 5) {
    $('boardStatus').textContent = side + ' team is full. Remove an operator before adding another.';
    return;
  }
  if (picked) state[side] = state[side].filter(x => x !== op);
  else state[side].push(op);
  render();
  $('boardStatus').textContent = op + (picked ? ' removed from ' : ' added to ') + side + '.';
  const card = [...document.querySelectorAll('.op')].find(el => el.dataset.operator === op);
  card?.focus({preventScroll:true});
}
function makeCard(op, side, picked=false) {
  const modeled = state.model?.operators.includes(asModel(op));
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'op ' + (picked ? 'picked ' : '') + (!modeled ? 'unmodeled' : '');
  el.draggable = true;
  el.dataset.operator = op;
  el.dataset.side = side;
  el.setAttribute('aria-label', (picked ? 'Remove ' : 'Add ') + op + (picked ? ' from ' : ' to ') + side + (!modeled ? ' (no historical model)' : ''));
  el.title = picked ? 'Remove ' + op : 'Add ' + op + (!modeled ? ' · No historical model coefficients' : '');
  el.innerHTML = '<img loading="lazy" width="58" height="58" src="' + imageUrl(op) + '" alt=""><span class="name">' + op + '</span>' + (picked ? '<span class="remove" aria-hidden="true">×</span>' : '');
  const img = el.querySelector('img');
  img.onerror = () => { img.onerror=null; img.src=fallbackIcon; };
  el.onclick = () => togglePick(op, side);
  el.addEventListener('dragstart', e => { state.dragOp={op,side}; e.dataTransfer.setData('text/plain',op); e.dataTransfer.effectAllowed='move'; });
  el.addEventListener('dragend', () => state.dragOp=null);
  return el;
}
function pair(a,b){return [a,b].sort().join('|')}
function effects(op,side){const m=state.model,c=asModel(op),sign=side==='Attack'?1:-1;const main=(side==='Attack'?m.attack_main:m.defense_main)[c]||0;let synergy=0,matchup=0;const allies=state[side].map(asModel),enemies=state[side==='Attack'?'Defense':'Attack'].map(asModel);const ally=m[side==='Attack'?'attack_ally':'defense_ally'];for(const a of allies)synergy+=sign*(ally[pair(c,a)]||0);for(const e of enemies){const k=side==='Attack'?`${c}|${e}`:`${e}|${c}`;matchup+=sign*(m.matchup[k]||0)}return {base:sign*main,synergy,matchup,total:sign*main+synergy+matchup}}
function render(){const open=$('openSide').value,closed=open==='Attack'?'Defense':'Attack';for(const [side,poolId,teamId,searchId,countId] of [['Attack','attackPool','attackTeam','attackSearch','attackCount'],['Defense','defensePool','defenseTeam','defenseSearch','defenseCount']]){const pool=$(poolId),team=$(teamId),q=$(searchId).value.toLowerCase();pool.replaceChildren();team.replaceChildren();for(const op of (side==='Attack'?attackers:defenders)){if(state[side].includes(op)||state.banned.has(op)||state.Attack.includes(op)||state.Defense.includes(op))continue;if(op.toLowerCase().includes(q))pool.append(makeCard(op,side))}for(const op of state[side])team.append(makeCard(op,side,true));for(let slot=state[side].length;slot<5;slot++){const empty=document.createElement('span');empty.className='slot';empty.innerHTML='<b aria-hidden="true">'+String(slot+1).padStart(2,'0')+'</b><span>Open slot</span>';team.append(empty)}if(!pool.children.length)pool.innerHTML='<p class="empty">No operators match your search.</p>';$(countId).textContent=`${state[side].length} / 5`;$(teamId).classList.toggle('open-side',side===open);$(teamId).setAttribute('aria-label',`${side} team drop zone`)}
const recList=$('recList'), prompt=$('recPrompt');recList.replaceChildren();$('recTitle').textContent='Top 3 '+open.toLowerCase()+' recommendations';if(!state.model){prompt.textContent=state.modelError?'Scoring unavailable. Reload to retry; you can still build both teams.':'Loading historical scoring model…';return}if(state[open].length===5){prompt.textContent=open+' team complete. Remove a pick to compare the next slot.';recList.innerHTML='<div class="empty">All five slots are filled.</div>';return}if(!state[open].length){$('recTitle').textContent=`Top 3 ${open.toLowerCase()} recommendations`;prompt.textContent=`Choose at least one operator on the open ${open.toLowerCase()} side to activate recommendations.`;recList.innerHTML='<div class="empty">Recommendations appear after the first pick on the open side.</div>';return}prompt.textContent=`Based on ${state[open].length} known ${open.toLowerCase()} pick${state[open].length===1?'':'s'}, ally synergy, enemy matchup, and the available historical base score.`;const other=state[closed];const chosen=new Set([...state.Attack,...state.Defense]);const candidates=(open==='Attack'?attackers:defenders).filter(op=>!chosen.has(op)&&!state.banned.has(op)&&state.model.operators.includes(asModel(op))).map(op=>({op,...effects(op,open)})).sort((a,b)=>b.total-a.total).slice(0,3);for(const [i,r] of candidates.entries()){const card=document.createElement('div');card.className='rec-card';card.innerHTML=`<span class="rank">0${i+1}</span><img width="52" height="52" src="${imageUrl(r.op)}" alt=""><div><strong>${r.op}</strong><span class="score">Relative score ${r.total>=0?'+':''}${r.total.toFixed(3)} · base ${r.base>=0?'+':''}${r.base.toFixed(3)}</span></div>`;const img=card.querySelector('img');img.onerror=()=>{img.onerror=null;img.src=fallbackIcon};recList.append(card)}if(!candidates.length)recList.innerHTML='<div class="empty">No available operators from the trained model remain for this side.</div>';if(other.length===5)prompt.textContent+=` Closed ${closed.toLowerCase()} team is full.`}
document.querySelectorAll('.dropzone').forEach(zone=>{zone.addEventListener('dragover',e=>{if(state.dragOp&&state.dragOp.side===zone.dataset.side){e.preventDefault();zone.classList.add('dragover')}});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');const d=state.dragOp;if(!d||d.side!==zone.dataset.side)return;if(zone.id.endsWith('Team')&&!state[d.side].includes(d.op)&&state[d.side].length<5&&!state.banned.has(d.op)){state[d.side].push(d.op);render()}})});
$('openSide').onchange=render;$('attackSearch').oninput=render;$('defenseSearch').oninput=render;
$('randomTeam').onclick=()=>{const open=$('openSide').value,closed=open==='Attack'?'Defense':'Attack';const used=new Set([...state.Attack,...state.Defense,...state.banned]);const options=(closed==='Attack'?attackers:defenders).filter(op=>!used.has(op));for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]]}state[closed]=options.slice(0,5);render()};
$('clear').onclick=()=>{if((state.Attack.length||state.Defense.length)&&!confirm('Reset both teams? Your current picks will be cleared.'))return;state.Attack=[];state.Defense=[];state.banned.clear();render();$('boardStatus').textContent='Both teams reset.'};
document.querySelectorAll('.pool').forEach(el=>{el.addEventListener('dragover',e=>{if(state.dragOp&&state.dragOp.side===el.dataset.side){e.preventDefault();el.classList.add('dragover')}});el.addEventListener('dragleave',()=>el.classList.remove('dragover'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');const d=state.dragOp;if(d&&d.side===el.dataset.side&&state[d.side].includes(d.op)){state[d.side]=state[d.side].filter(x=>x!==d.op);render()}})});
render();
fetch(modelPath).then(r=>{if(!r.ok)throw new Error('Model unavailable');return r.json()}).then(m=>{state.model=m;$('dataLabel').textContent=`Trained coefficients: ${m.data_label}. Current patch reference: Y11S3.1 (Sep 22, 2026); Ubisoft operator chart reference: Y11S2.3.`;render()}).catch(()=>{state.modelError=true;$('dataLabel').textContent='Model file model/model.json could not be loaded. Reload to retry.';render()});

