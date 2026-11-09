(()=> {
const $=id=>document.getElementById(id);
const state={records:[],yearsDone:0,totalYears:0,loading:false,complete:false,top:[],focus:0,replayTimer:null};
const yearNow=new Date().getFullYear();
const teamColors={ferrari:'#E8002D',red_bull:'#3671C6','red-bull-racing':'#3671C6',mercedes:'#00A19B',mclaren:'#FF8700','aston-martin':'#16866B',alpine:'#0093CC',williams:'#005AFF',haas:'#B6BABD',rb:'#6692FF',sauber:'#52A96B','racing-bulls':'#6692FF',renault:'#D5C500',lotus:'#006B3F',brawn:'#91B500',maserati:'#3A9AD9',alfaromeo:'#B60018',brm:'#3C8D5A',cooper:'#1D8C5A',matra:'#1D73B8',tyrrell:'#1D73B8'};
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString();
const color=r=>teamColors[String(r.constructor_id||'').toLowerCase()]||'#9aa4b3';
const isClassified=r=>/^\d+$/.test(String(r.classification_text||r.official_finish_position||''));
const label=r=>'P'+r.finish_position;
function init(){
 const sel=$('season');sel.innerHTML='<option value="all">ALL SEASONS</option>'+Array.from({length:yearNow-1949},(_,i)=>yearNow-i).map(y=>'<option value="'+y+'">'+y+'</option>').join('');
 $('load').addEventListener('click',loadArchive);$('replay').addEventListener('click',toggleReplay);
 $('next').addEventListener('click',()=>step(1));$('prev').addEventListener('click',()=>step(-1));
 $('season').addEventListener('change',()=>{$('era').value='all';render()});$('era').addEventListener('change',()=>{$('season').value='all';render()});
 ['scope','threshold','driver'].forEach(id=>$(id).addEventListener('change',render));
 $('video').addEventListener('click',openVideo);$('closeVideo').addEventListener('click',closeVideo);
 window.addEventListener('keydown',e=>{if(e.key==='Escape')closeVideo();if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)});
 loadArchive();
}
async function getYear(y){
 const response=await fetch('/api/last-lap-swings?year='+y,{cache:'no-store'});
 const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||('Season '+y+' failed'));
 return body.records||[];
}
async function loadArchive(){
 if(state.loading)return;state.loading=true;state.complete=false;$('load').disabled=true;$('load').textContent='LOADING ARCHIVE…';
 const years=Array.from({length:yearNow-1949},(_,i)=>yearNow-i).reverse();
 state.records=[];state.yearsDone=0;state.totalYears=years.length;$('progress').style.width='0%';
 $('status').textContent='CONNECTING TO THE HISTORICAL CLASSIFICATION ARCHIVE · '+years.length+' SEASONS';
 let cursor=0,failures=[];
 const worker=async()=>{while(cursor<years.length){const y=years[cursor++];let rows=null;for(let attempt=0;attempt<3;attempt++){try{rows=await getYear(y);break}catch(e){if(attempt===2)failures.push(y);else await new Promise(resolve=>setTimeout(resolve,900*(attempt+1)))}}if(rows)state.records.push(...rows);
 state.yearsDone++;$('progress').style.width=(state.yearsDone/state.totalYears*100)+'%';
 if(state.yearsDone%3===0){state.records=dedupe(state.records);populateDrivers();render()}
 $('status').textContent='ARCHIVE INGEST · '+state.yearsDone+'/'+state.totalYears+' SEASONS · '+fmt(state.records.length)+' DRIVER RESULTS · '+(failures.length?failures.length+' RETRIES EXHAUSTED':'RETRY-SAFE FETCH');
 }};
 try{await Promise.all(Array.from({length:3},worker));state.complete=failures.length===0;state.records=dedupe(state.records);populateDrivers();render();
 $('status').textContent='ARCHIVE READY · '+fmt(state.records.length)+' DRIVER RESULTS · '+fmt(new Set(state.records.map(r=>r.race_key)).size)+' GRAND PRIX · '+(failures.length?failures.length+' SEASONS MISSED: '+failures.slice(0,15).join(', ')+(failures.length>15?'…':''):'ALL SEASONS CHECKED');
 }catch(e){$('status').textContent='ARCHIVE ERROR · '+e.message}
 finally{state.loading=false;$('load').disabled=false;$('load').textContent='↻ REFRESH ARCHIVE';render()}
}
function dedupe(rows){const map=new Map();for(const r of rows){const k=r.race_key+':'+r.driver_key;const old=map.get(k);if(!old||Number(r.finish_position)<Number(old.finish_position))map.set(k,r)}return [...map.values()]}
function populateDrivers(){const drivers=[...new Map(state.records.map(r=>[r.driver_key,{id:r.driver_key,name:r.driver_name}])).values()].sort((a,b)=>a.name.localeCompare(b.name));const old=$('driver').value;$('driver').innerHTML='<option value="all">ALL DRIVERS</option>'+drivers.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('');if(drivers.some(d=>d.id===old))$('driver').value=old}
function filtered(){
 const season=$('season').value,era=$('era').value,scope=$('scope').value,min=Number($('threshold').value),driver=$('driver').value;
 return state.records.filter(r=>{
  if(scope==='classified'&&!isClassified(r))return false;
  if(Number(r.positions_gained)<min)return false;
  if(season!=='all'&&Number(r.season)!==Number(season))return false;
  if(era!=='all'&&Math.floor(Number(r.season)/10)*10!==Number(era))return false;
  if(driver!=='all'&&r.driver_key!==driver)return false;
  return Number(r.start_position)>0&&Number(r.finish_position)>0;
 }).sort((a,b)=>Number(b.positions_gained)-Number(a.positions_gained)||Number(a.season)-Number(b.season)||Number(a.round)-Number(b.round));
}
function render(){
 stopReplay();const rows=filtered(),classified=state.records.filter(isClassified);
 const best=rows[0],ten=classified.filter(r=>Number(r.positions_gained)>=10).length;
 $('statBest').textContent=best?'+'+best.positions_gained:'—';
 $('statBestMeta').textContent=best?best.driver_name+' · '+best.season+' '+best.race_name:'NO MATCHING COMEBACKS';
 $('stat10').textContent=fmt(ten);$('statRaces').textContent=fmt(new Set(rows.map(r=>r.race_key)).size);
 $('statSeasonMeta').textContent=fmt(new Set(rows.map(r=>r.season)).size)+' SEASONS IN CURRENT FILTER';
 $('statRows').textContent=fmt(rows.length);
 $('featureTag').textContent=state.complete?'01 / THE GREATEST CLASSIFIED COMEBACK':state.loading?'01 / LEADING COMEBACK · ARCHIVE IN PROGRESS':'01 / PROVISIONAL · INCOMPLETE ARCHIVE';
 $('statSeasonMeta').textContent=fmt(new Set(rows.map(r=>r.season)).size)+' SEASONS IN CURRENT FILTER'+(!state.complete?' · PROVISIONAL':'');
 if(best){$('featureGain').textContent='+'+best.positions_gained;$('featureDriver').textContent=best.driver_name;$('featureRace').textContent=best.season+' · '+best.race_name+' · '+(best.constructor_name||'TEAM UNAVAILABLE');$('featureGrid').textContent='P'+best.start_position;$('featureFinish').textContent=label(best)}
 else{$('featureGain').textContent='—';$('featureDriver').textContent='NO MATCHING RESULT';$('featureRace').textContent='Adjust the filters to reveal another comeback.';$('featureGrid').textContent='—';$('featureFinish').textContent='—'}
 state.top=rows.slice(0,20);state.focus=Math.min(state.focus,Math.max(0,Math.min(state.top.length,12)-1));
 $('leaderMeta').textContent='TOP '+state.top.length+' · '+($('scope').value==='classified'?'CLASSIFIED FINISHERS':'ALL OFFICIAL RESULTS');
 $('tableMeta').textContent=fmt(rows.length)+' RECORDS · SORTED BY POSITIONS GAINED';
 $('leaderboard').innerHTML=state.top.slice(0,20).map((r,i)=>'<div class="lb-card" style="--team:'+color(r)+'"><div class="lb-rank">'+String(i+1).padStart(2,'0')+'</div><div><div class="lb-name">'+esc(r.driver_name)+'</div><div class="lb-meta">'+esc(r.race_name)+' · '+r.season+' · '+esc(r.constructor_name||'—')+'</div></div><div class="lb-move">+'+r.positions_gained+'<small>'+('P'+r.start_position+' → '+label(r))+'</small></div></div>').join('')||'<div class="lb-card">No records match these filters.</div>';
 $('ledger').innerHTML=rows.slice(0,250).map((r,i)=>'<tr><td>'+String(i+1).padStart(3,'0')+'</td><td class="driver">'+esc(r.driver_name)+'</td><td>'+esc(r.race_name)+'</td><td>'+r.season+'</td><td><span style="display:inline-block;width:4px;height:15px;background:'+color(r)+';vertical-align:middle;margin-right:7px"></span>'+esc(r.constructor_name||'—')+'</td><td>P'+r.start_position+'</td><td>P'+r.finish_position+'</td><td class="gain">+'+r.positions_gained+'</td><td class="status">'+(isClassified(r)?'CLASSIFIED':esc(r.classification_text||r.status||'UNCLASSIFIED'))+'</td></tr>').join('')||'<tr><td colspan="9">No records match these filters.</td></tr>';
 drawSlope(state.top);updateStory();
}
function drawSlope(rows){
 const svg=$('slope');if(!rows.length){svg.innerHTML='<text x="500" y="250" text-anchor="middle" fill="#87909d" font-size="14">No comeback results for these filters</text>';return}
 const topRows=rows.slice(0,12),maxPos=Math.max(20,...topRows.map(r=>Number(r.start_position)||0),...topRows.map(r=>Number(r.finish_position)||0));
 const top=52,bottom=458,left=170,right=820,step=(bottom-top)/Math.max(1,maxPos-1),slot=(bottom-top)/Math.max(1,topRows.length-1);
 let out='';
 for(let p=1;p<=maxPos;p++){const y=top+(p-1)*step;if(p===1||p%5===0||p===maxPos){out+='<line class="gridline" x1="'+left+'" x2="'+right+'" y1="'+y+'" y2="'+y+'"/><text class="mutelabel" x="'+(left+10)+'" y="'+(y+3)+'">P'+p+'</text>'}}
 out+='<line class="axis" x1="'+left+'" x2="'+left+'" y1="28" y2="480"/><line class="axis" x1="'+right+'" x2="'+right+'" y1="28" y2="480"/><text class="axislabel" x="'+left+'" y="18" text-anchor="middle">STARTING GRID</text><text class="axislabel" x="'+right+'" y="18" text-anchor="middle">FINAL POSITION</text>';
 topRows.forEach((r,i)=>{
  const y1=top+(Number(r.start_position)-1)*step,y2=top+(Number(r.finish_position)-1)*step,labelY=topRows.length===1?top:(top+i*slot),c=color(r),active=i===state.focus;
  const name=r.driver_name.length>16?r.driver_name.slice(0,15)+'…':r.driver_name;
  out+='<path d="M 126 '+labelY+' L '+(left-5)+' '+y1+'" stroke="'+c+'" stroke-width="1" opacity=".28" fill="none"/><path d="M '+(right+5)+' '+y2+' L 875 '+labelY+'" stroke="'+c+'" stroke-width="1" opacity=".32" fill="none"/>';
  out+='<path class="route '+(active?'active':'')+'" d="M '+left+' '+y1+' C 365 '+y1+', 625 '+y2+', '+right+' '+y2+'" stroke="'+c+'" style="color:'+c+'" opacity="'+(active?1:.58)+'"/>';
  out+='<circle class="endpoint" cx="'+left+'" cy="'+y1+'" r="'+(active?7:5)+'" fill="'+c+'"/><circle class="endpoint" cx="'+right+'" cy="'+y2+'" r="'+(active?7:5)+'" fill="'+c+'"/>';
  out+='<text class="driverlabel" x="8" y="'+(labelY-2)+'" fill="'+c+'">'+String(i+1).padStart(2,'0')+' '+esc(name)+'</text><text class="mutelabel" x="8" y="'+(labelY+11)+'">GRID P'+r.start_position+' · +'+r.positions_gained+'</text>';
  out+='<text class="poslabel" x="884" y="'+(labelY+4)+'">'+label(r)+'</text><text class="mutelabel" x="500" y="'+(Math.min(y1,y2)+Math.abs(y2-y1)*.5-6)+'" text-anchor="middle">+'+r.positions_gained+'</text>';
 });
 svg.innerHTML=out;
 svg.querySelectorAll('.route').forEach((el,i)=>{el.style.cursor='pointer';el.addEventListener('click',()=>{state.focus=i;drawSlope(state.top);updateStory()})});
}
function step(delta){const n=Math.min(state.top.length,12);if(!n)return;state.focus=(state.focus+delta+n)%n;drawSlope(state.top);updateStory()}
function updateStory(){const r=state.top[state.focus];$('storyCount').textContent=String(state.focus+1).padStart(2,'0')+' / '+String(state.top.length).padStart(2,'0');$('storyProgress').style.width=(state.top.length?(state.focus+1)/state.top.length*100:0)+'%';if(r){$('videoGain').textContent='+'+r.positions_gained;$('videoName').textContent=r.driver_name;$('videoRace').textContent=r.race_name+' · '+r.season+' · '+(r.constructor_name||'');$('videoPositions').textContent='GRID P'+r.start_position+' / FINISH '+label(r);$('videoSvg').innerHTML='<defs><linearGradient id="vg" x1="0" x2="1"><stop stop-color="'+color(r)+'"/><stop offset="1" stop-color="#c8ff45"/></linearGradient></defs><path d="M105 100 C 330 100 420 400 695 400" fill="none" stroke="url(#vg)" stroke-width="8" stroke-linecap="round"/><path d="M105 100 C 330 100 420 400 695 400" fill="none" stroke="#ffffff" stroke-opacity=".13" stroke-width="24" stroke-linecap="round"/><circle cx="105" cy="100" r="55" fill="#11151b" stroke="'+color(r)+'" stroke-width="3"/><circle cx="695" cy="400" r="55" fill="#11151b" stroke="#c8ff45" stroke-width="3"/><text x="105" y="92" text-anchor="middle" fill="#fff" font-size="34" font-family="Barlow Condensed" font-weight="900">P'+r.start_position+'</text><text x="105" y="120" text-anchor="middle" fill="#9da6b3" font-size="11" font-family="IBM Plex Mono">GRID</text><text x="695" y="392" text-anchor="middle" fill="#fff" font-size="34" font-family="Barlow Condensed" font-weight="900">'+label(r)+'</text><text x="695" y="420" text-anchor="middle" fill="#9da6b3" font-size="11" font-family="IBM Plex Mono">FINISH</text><text x="405" y="215" text-anchor="middle" fill="#c8ff45" font-size="38" font-family="IBM Plex Mono" font-weight="700">+'+r.positions_gained+'</text><text x="405" y="242" text-anchor="middle" fill="#9da6b3" font-size="11" font-family="IBM Plex Mono">POSITIONS GAINED</text>'}}
function toggleReplay(){if(state.replayTimer){stopReplay();$('replay').textContent='▶ REPLAY';return}if(!state.top.length)return;state.focus=0;updateStory();$('replay').textContent='Ⅱ PAUSE';state.replayTimer=setInterval(()=>{if(state.focus>=Math.min(state.top.length,12)-1){stopReplay();$('replay').textContent='↻ REPLAY';return}step(1)},2100)}
function stopReplay(){if(state.replayTimer){clearInterval(state.replayTimer);state.replayTimer=null;$('replay').textContent='▶ REPLAY'}}
function openVideo(){if(!state.top.length)return;stopReplay();$('broadcast').classList.add('on');$('broadcast').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';updateStory()}
function closeVideo(){$('broadcast').classList.remove('on');$('broadcast').setAttribute('aria-hidden','true');document.body.style.overflow=''}
init();
})();