const $ = (q) => document.querySelector(q);

let songs = [];
let tubes = [];
let currentSong = null;
let currentRecord = null;

const ROW_TOP = "superior";
const ROW_BOTTOM = "inferior";

function tubeHeight(position, row) {
  const max = row === ROW_TOP ? 12 : 11;
  const minH = 82;
  const maxH = 205;
  const ratio = (Number(position) - 1) / (max - 1);
  return Math.round(minH + ratio * (maxH - minH)); // pequeño -> grande
}

function tubeCode(tube) {
  return Number(tube?.posicion || tube?.numero || 0);
}

function tubeDisplayNote(tube) {
  if (!tube?.nota) return "—";
  const spanish = {
    C:"Do","C#":"Do#",
    D:"Re","D#":"Re#",
    E:"Mi",F:"Fa","F#":"Fa#",
    G:"Sol","G#":"Sol#",
    A:"La","A#":"La#",
    B:"Si"
  };
  const m = String(tube.nota).match(/^([A-G](?:#)?)(\d+)?$/);
  if (!m) return tube.nota;
  return spanish[m[1]] || m[1];
}

function renderTube(tube, rowClass="") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `z-pipe ${rowClass}`;
  btn.style.height = `${tubeHeight(tube.posicion, tube.fila)}px`;
  btn.dataset.id = tube.id;
  btn.dataset.fila = tube.fila;
  btn.dataset.tubo = String(tubeCode(tube));

  btn.innerHTML = `
    <span class="z-pipe-hole"></span>
    <span class="z-pipe-number">${tubeCode(tube)}</span>
    <span class="z-pipe-note">${tubeDisplayNote(tube)}</span>
    <small>${tube.nota || ""}</small>
  `;

  btn.addEventListener("click", () => playTube(tube, true));
  return btn;
}

function renderInstrument() {
  const top = $("#upperRow");
  const bottom = $("#lowerRow");
  top.replaceChildren();
  bottom.replaceChildren();

  tubes
    .filter(t => t.fila === ROW_TOP)
    .sort((a,b) => Number(a.posicion)-Number(b.posicion))
    .forEach(t => top.append(renderTube(t,"is-top")));

  tubes
    .filter(t => t.fila === ROW_BOTTOM)
    .sort((a,b) => Number(a.posicion)-Number(b.posicion))
    .forEach(t => bottom.append(renderTube(t,"is-bottom")));
}

function highlightTube(tube) {
  document.querySelectorAll(".z-pipe").forEach(x => x.classList.remove("is-active"));
  const el = document.querySelector(`.z-pipe[data-id="${tube.id}"]`);
  if (!el) return;
  el.classList.add("is-active");
  setTimeout(() => el.classList.remove("is-active"), 500);
}

function synth(freq, duration=.72) {
  const f = Number(freq);
  if (!f) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.value = f;
  filter.type = "lowpass";
  filter.frequency.value = 1500;
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.12, now + .025);
  gain.gain.exponentialRampToValueAtTime(.0001, now + Math.max(.3,duration));

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + Math.max(.35,duration) + .05);
}

function playTube(tube, highlight=false, duration=1) {
  if (highlight) highlightTube(tube);
  synth(tube.frecuencia, .55 * Math.max(.5, Number(duration)||1));
}

function findTube(fila, numero) {
  return tubes.find(t => t.fila === fila && tubeCode(t) === Number(numero));
}

function legacyToStructure(secciones) {
  const labels = {intro:"Intro",verso:"Verso",coro:"Coro",puente:"Puente",final:"Final"};
  const result = [];
  Object.entries(labels).forEach(([key,label]) => {
    const raw = secciones?.[key];
    if (!raw) return;

    let values = [];
    let comment = "";

    if (Array.isArray(raw)) values = raw;
    else if (typeof raw === "object") {
      comment = String(raw.comentario || "");
      if (Array.isArray(raw.eventos)) {
        result.push({
          id:`legacy-${key}`,
          tipo:"parte",
          nombre:label,
          comentario:comment,
          eventos:raw.eventos.map(ev => normalizeEvent(ev)).filter(Boolean)
        });
        return;
      }
    }

    if (values.length || comment) {
      result.push({
        id:`legacy-${key}`,
        tipo:"parte",
        nombre:label,
        comentario:comment,
        eventos: values.map(v => {
          const n = Number(v);
          return Number.isFinite(n)
            ? {tipo:"nota", fila:ROW_TOP, tubo:n, duracion:1}
            : null;
        }).filter(Boolean)
      });
    }
  });
  return result;
}

function normalizeEvent(ev) {
  if (!ev) return null;

  if (ev.tipo === "separador") return {tipo:"separador"};

  if (ev.tipo === "arrastre" && ev.desde && ev.hasta) {
    return {
      tipo:"arrastre",
      desde:{fila:ev.desde.fila, tubo:Number(ev.desde.tubo)},
      hasta:{fila:ev.hasta.fila, tubo:Number(ev.hasta.tubo)},
      duracion:Number(ev.duracion)||1
    };
  }

  if (ev.tipo === "nota") {
    return {
      tipo:"nota",
      fila:ev.fila || ROW_TOP,
      tubo:Number(ev.tubo),
      duracion:Number(ev.duracion)||1
    };
  }

  if (typeof ev === "object" && ev.tubo != null) {
    return {
      tipo:"nota",
      fila:ev.fila || ROW_TOP,
      tubo:Number(ev.tubo),
      duracion:Number(ev.duracion)||1
    };
  }

  return null;
}

function getStructure(record) {
  const raw = record?.secciones || {};
  if (Array.isArray(raw.estructura)) {
    return raw.estructura.map(item => {
      if (item.tipo === "divisor") {
        return {
          id:item.id || crypto.randomUUID(),
          tipo:"divisor",
          texto:String(item.texto || item.comentario || "")
        };
      }
      return {
        id:item.id || crypto.randomUUID(),
        tipo:"parte",
        nombre:String(item.nombre || "Parte"),
        comentario:String(item.comentario || ""),
        eventos:(item.eventos || []).map(normalizeEvent).filter(Boolean)
      };
    });
  }
  return legacyToStructure(raw);
}


function eventPoints(events) {
  const pts = [];
  events.forEach((ev,eventIndex) => {
    if (!ev) return;
    if (ev.tipo === "separador") {
      pts.push({kind:"separator",eventIndex,ev});
      return;
    }
    if (ev.tipo === "arrastre") {
      pts.push({kind:"drag-start",fila:ev.desde.fila,tubo:ev.desde.tubo,ev,eventIndex,halfGroup:null});
      pts.push({kind:"drag-end",fila:ev.hasta.fila,tubo:ev.hasta.tubo,ev,eventIndex,halfGroup:null});
      return;
    }
    pts.push({kind:"note",fila:ev.fila,tubo:ev.tubo,ev,eventIndex,halfGroup:null});
  });

  let halfCounter = 0;
  for (let i=0;i<pts.length-1;i++) {
    const a=pts[i], b=pts[i+1];
    if (
      a.kind==="note" &&
      b.kind==="note" &&
      Number(a.ev?.duracion)===0.5 &&
      Number(b.ev?.duracion)===0.5
    ) {
      const id=`half-${halfCounter++}`;
      a.halfGroup=id; b.halfGroup=id; i++;
    }
  }
  return pts;
}

function renderNotation(events) {
  const points = eventPoints(events);
  const unit = 82, separatorGap = 72, pad = 38;
  const yTop = 42, yBottom = 112, height = 165;

  let cursor = pad;
  const positioned = [];
  points.forEach(p => {
    if (p.kind === "separator") {
      cursor += separatorGap;
      positioned.push({...p,x:cursor});
      cursor += separatorGap * .35;
    } else {
      positioned.push({...p,x:cursor});
      cursor += unit;
    }
  });

  const width = Math.max(520, cursor + pad);
  const wrap = document.createElement("div");
  wrap.className = "z-notation-scroll";

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS,"svg");
  svg.setAttribute("class","z-notation");
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
  svg.setAttribute("width",width);
  svg.setAttribute("height",height);

  const defs = document.createElementNS(NS,"defs");
  defs.innerHTML = `
    <marker id="zArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#382052"></path>
    </marker>`;
  svg.append(defs);

  const yFor = p => p.fila===ROW_TOP ? yTop : yBottom;

  function prevRealIndex(index) {
    for (let i=index-1;i>=0;i--) {
      if (positioned[i].kind === "separator") return -1;
      return i;
    }
    return -1;
  }

  // Flecha SOLO cuando cambia de fila.
  for (let i=1;i<positioned.length;i++) {
    const b=positioned[i];
    if (b.kind==="separator") continue;
    const ai=prevRealIndex(i);
    if (ai<0) continue;
    const a=positioned[ai];

    const sameDrag = a.ev===b.ev && a.ev?.tipo==="arrastre";
    if (sameDrag) {
      const path=document.createElementNS(NS,"path");
      const Ay=yFor(a), By=yFor(b), mid=(a.x+b.x)/2;
      const curveY=Math.max(Ay,By)+28;
      path.setAttribute("d",`M ${a.x+12} ${Ay+8} Q ${mid} ${curveY} ${b.x-12} ${By+8}`);
      path.setAttribute("class","z-drag-path");
      svg.append(path);
    } else if (a.fila !== b.fila) {
      const line=document.createElementNS(NS,"line");
      line.setAttribute("x1",a.x+12); line.setAttribute("y1",yFor(a));
      line.setAttribute("x2",b.x-15); line.setAttribute("y2",yFor(b));
      line.setAttribute("class","z-transition-line");
      line.setAttribute("marker-end","url(#zArrow)");
      svg.append(line);
    }
  }

  // Sombrerito para pares consecutivos de medio tiempo.
  const groups = new Map();
  positioned.forEach(p=>{
    if(!p.halfGroup) return;
    if(!groups.has(p.halfGroup)) groups.set(p.halfGroup,[]);
    groups.get(p.halfGroup).push(p);
  });

  groups.forEach(group=>{
    if(group.length!==2) return;
    const [a,b]=group;
    const topY=Math.min(yFor(a),yFor(b))-24;
    const path=document.createElementNS(NS,"path");
    const mid=(a.x+b.x)/2;
    path.setAttribute("d",`M ${a.x-10} ${topY+8} Q ${mid} ${topY-9} ${b.x+10} ${topY+8}`);
    path.setAttribute("class","z-half-time-hat");
    svg.append(path);
  });

  positioned.forEach(p=>{
    if(p.kind==="separator") {
      const marker=document.createElementNS(NS,"line");
      marker.setAttribute("x1",p.x); marker.setAttribute("x2",p.x);
      marker.setAttribute("y1",25); marker.setAttribute("y2",135);
      marker.setAttribute("class","z-phrase-divider");
      svg.append(marker);
      return;
    }
    const y=yFor(p);
    const t=document.createElementNS(NS,"text");
    t.setAttribute("x",p.x); t.setAttribute("y",y+6);
    t.setAttribute("text-anchor","middle");
    t.setAttribute("class","z-notation-number");
    t.dataset.eventIndex=String(p.eventIndex);
    t.dataset.fila=p.fila;
    t.dataset.tubo=String(p.tubo);
    t.textContent=p.tubo;
    svg.append(t);

    if(Number(p.ev?.duracion)!==1 && Number(p.ev?.duracion)!==0.5 && p.kind!=="drag-end") {
      const d=document.createElementNS(NS,"text");
      d.setAttribute("x",p.x); d.setAttribute("y",y-18);
      d.setAttribute("text-anchor","middle");
      d.setAttribute("class","z-duration-label");
      d.textContent=`×${p.ev.duracion}`;
      svg.append(d);
    }
  });

  wrap.append(svg);
  return wrap;
}


function renderStructure(record) {
  const host=$("#publicStructure");
  host.replaceChildren();
  const structure=getStructure(record);

  structure.forEach(item=>{
    if(item.tipo==="divisor"){
      const div=document.createElement("div");
      div.className="z-divider";
      div.innerHTML=`<span></span><strong>${item.texto || "Comentario"}</strong><span></span>`;
      host.append(div);
      return;
    }

    const section=document.createElement("section");
    section.className="z-part";

    const side=document.createElement("div");
    side.className="z-part-label";
    side.innerHTML=`<strong>${item.nombre}</strong>${item.comentario?`<small>${item.comentario}</small>`:""}`;

    const score=document.createElement("div");
    score.className="z-part-score";
    score.append(renderNotation(item.eventos));

    section.append(side,score);
    host.append(section);
  });

  if (!structure.length) {
    const empty=document.createElement("div");
    empty.className="z-empty-score";
    empty.textContent="Aún no se registraron partes para esta canción.";
    host.append(empty);
  }
}

















function setPlaybackHighlight(fila,tubo,eventIndex=null,on=true){
  document.querySelectorAll(".z-pipe").forEach(el=>{
    const match=el.dataset.fila===fila && Number(el.dataset.tubo)===Number(tubo);
    if(match) el.classList.toggle("is-playing",on);
  });

  document.querySelectorAll(".z-notation-number").forEach(el=>{
    const sameTube=el.dataset.fila===fila && Number(el.dataset.tubo)===Number(tubo);
    const sameEvent=eventIndex===null || Number(el.dataset.eventIndex)===Number(eventIndex);
    if(sameTube && sameEvent) el.classList.toggle("is-playing",on);
  });
}

function clearPlaybackHighlights(){
  document.querySelectorAll(".is-playing").forEach(el=>el.classList.remove("is-playing"));
}

let playbackRunId = 0;
let activeAudioContext = null;

function getPlaybackSpeedSnapshot(){
  const v=Number(document.querySelector("#playbackSpeed")?.value || 1);
  return Math.max(.5,Math.min(3,v || 1));
}

function stopPlayback(){
  playbackRunId++;
  clearPlaybackHighlights();
  if(activeAudioContext){
    try{ activeAudioContext.close(); }catch{}
    activeAudioContext=null;
  }
}

function waitPlayback(ms,runId){
  return new Promise(resolve=>{
    setTimeout(()=>resolve(runId===playbackRunId),Math.max(20,ms));
  });
}

function synthStable(freq,durationMs,runId){
  const f=Number(freq);
  if(!f || runId!==playbackRunId) return;

  if(!activeAudioContext || activeAudioContext.state==="closed"){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    activeAudioContext=new Ctx();
  }

  const ctx=activeAudioContext;
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  const filter=ctx.createBiquadFilter();

  osc.type="sine";
  osc.frequency.value=f;
  filter.type="lowpass";
  filter.frequency.value=1500;

  const seconds=Math.max(.07,durationMs/1000);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.12,now+.015);
  gain.gain.exponentialRampToValueAtTime(.0001,now+seconds);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now+seconds+.015);
}

async function playGuidedNote(fila,tubo,eventIndex,durationUnits,speed,runId){
  if(runId!==playbackRunId) return false;

  clearPlaybackHighlights();
  setPlaybackHighlight(fila,tubo,eventIndex,true);

  const tube=findTube(fila,tubo);
  const baseMs=520*Math.max(.25,Number(durationUnits)||1);
  const ms=Math.max(80,Math.round(baseMs/speed));

  if(tube) synthStable(tube.frecuencia,ms*.9,runId);

  const ok=await waitPlayback(ms,runId);
  setPlaybackHighlight(fila,tubo,eventIndex,false);
  return ok;
}

function dragTubeNumbers(ev){
  if(!ev?.desde || !ev?.hasta) return [];
  if(ev.desde.fila!==ev.hasta.fila) return []; // seguridad absoluta
  const a=Number(ev.desde.tubo),b=Number(ev.hasta.tubo);
  const step=a<=b?1:-1;
  const values=[];
  for(let n=a;step>0?n<=b:n>=b;n+=step) values.push(n);
  return values;
}

async function playEventStable(ev,eventIndex,speed,runId){
  if(runId!==playbackRunId) return false;

  if(ev.tipo==="separador"){
    return await waitPlayback(Math.round(300/speed),runId);
  }

  if(ev.tipo==="arrastre"){
    if(ev.desde.fila!==ev.hasta.fila) return true;
    const nums=dragTubeNumbers(ev);
    if(!nums.length) return true;

    const totalUnits=Math.max(.5,Number(ev.duracion)||1);
    const eachUnits=totalUnits/nums.length;

    for(const tubo of nums){
      const ok=await playGuidedNote(ev.desde.fila,tubo,eventIndex,eachUnits,speed,runId);
      if(!ok) return false;
    }
    return true;
  }

  return await playGuidedNote(ev.fila,ev.tubo,eventIndex,ev.duracion||1,speed,runId);
}


async function playAll(){
  stopPlayback();
  const runId=playbackRunId;
  const speed=getPlaybackSpeedSnapshot();

  const btn=$("#playAllBtn");
  const speedSelect=$("#playbackSpeed");
  if(btn) btn.disabled=true;
  if(speedSelect) speedSelect.disabled=true;

  try{
    const structure=getStructure(currentRecord);
    const playable=structure.filter(x=>x.tipo==="parte");

    for(let pi=0;pi<playable.length;pi++){
      const item=playable[pi];

      for(let ei=0;ei<(item.eventos||[]).length;ei++){
        const ok=await playEventStable(item.eventos[ei],ei,speed,runId);
        if(!ok) return;
      }

      if(pi<playable.length-1){
        const ok=await waitPlayback(Math.round(420/speed),runId);
        if(!ok) return;
      }
    }
  } finally {
    clearPlaybackHighlights();
    if(btn) btn.disabled=false;
    if(speedSelect) speedSelect.disabled=false;
  }
}

$("#stopAllBtn")?.addEventListener("click",stopPlayback);

$("#playAllBtn").addEventListener("click",playAll);

async function fetchTubes() {
  const {data,error}=await window.CancioneroDB.client
    .from("zampona_tubos").select("*").eq("publicado",true).order("fila").order("posicion");
  if(error) throw error;
  return data || [];
}

async function fetchRecord(songId) {
  const {data,error}=await window.CancioneroDB.client
    .from("zampona_canciones").select("*").eq("cancion_id",songId).eq("publicado",true).maybeSingle();
  if(error) throw error;
  return data;
}

async function loadSelectedSong() {
  currentSong=songs.find(s=>String(s.id)===$("#songSelect").value)||songs[0];
  if(!currentSong) return;
  $("#songTitle").textContent=currentSong.titulo || "—";

  try {
    currentRecord=await fetchRecord(currentSong.id);
    const has=Boolean(currentRecord);
    $("#notPublished").hidden=has;
    $("#publicContent").hidden=!has;
    if(has) {
      renderInstrument();
      renderStructure(currentRecord);
      $("#publicStatus").textContent="Guía cargada";
    } else {
      $("#publicStatus").textContent="Sin guía publicada";
    }
  } catch(e) {
    console.error(e);
    $("#publicStatus").textContent=e.message || "No se pudo cargar Zampoña";
  }
}

async function init() {
  try {
    songs=await window.CancioneroDB.listSongs();
    tubes=await fetchTubes();

    const select=$("#songSelect");
    select.replaceChildren();
    songs.forEach(song=>{
      const opt=document.createElement("option");
      opt.value=song.id;
      opt.textContent=`${song.numero ? song.numero+" · " : ""}${song.titulo}`;
      select.append(opt);
    });

    const requested=new URLSearchParams(location.search).get("song");
    const match=songs.find(s=>String(s.id)===requested || String(s.numero)===requested);
    if(match) select.value=match.id;

    select.addEventListener("change",loadSelectedSong);
    await loadSelectedSong();
  } catch(e) {
    console.error(e);
    $("#publicStatus").textContent=e.message || "No se pudo iniciar Zampoña";
  }
}

init();
