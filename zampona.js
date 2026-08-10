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
  events.forEach(ev => {
    if (ev.tipo === "arrastre") {
      pts.push({kind:"drag-start", fila:ev.desde.fila, tubo:ev.desde.tubo, ev});
      pts.push({kind:"drag-end", fila:ev.hasta.fila, tubo:ev.hasta.tubo, ev});
    } else {
      pts.push({kind:"note", fila:ev.fila, tubo:ev.tubo, ev});
    }
  });
  return pts;
}

function renderNotation(events, interactive=false, onClick=null) {
  const points = eventPoints(events);
  const unit = 86;
  const pad = 34;
  const width = Math.max(520, pad*2 + points.length * unit);
  const height = 150;
  const yTop = 42;
  const yBottom = 112;

  const wrap = document.createElement("div");
  wrap.className = "z-notation-scroll";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("class","z-notation");
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
  svg.setAttribute("width",width);
  svg.setAttribute("height",height);

  const defs = document.createElementNS(svgNS,"defs");
  defs.innerHTML = `
    <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#382052"></path>
    </marker>
  `;
  svg.append(defs);

  function pointXY(index,p) {
    return {x:pad + index*unit + unit/2, y:p.fila===ROW_TOP ? yTop : yBottom};
  }

  // connectors between consecutive visible points
  for (let i=0;i<points.length-1;i++) {
    const a=points[i], b=points[i+1];
    // Internal connection of an arrastre gets curved line, no arrow.
    const sameDrag = a.ev === b.ev && a.ev?.tipo === "arrastre";
    const A=pointXY(i,a), B=pointXY(i+1,b);

    if (sameDrag) {
      const path=document.createElementNS(svgNS,"path");
      const midX=(A.x+B.x)/2;
      const curveY=Math.max(A.y,B.y)+28;
      path.setAttribute("d",`M ${A.x+12} ${A.y+8} Q ${midX} ${curveY} ${B.x-12} ${B.y+8}`);
      path.setAttribute("class","z-drag-path");
      svg.append(path);
    } else {
      const line=document.createElementNS(svgNS,"line");
      line.setAttribute("x1",A.x+12);
      line.setAttribute("y1",A.y);
      line.setAttribute("x2",B.x-15);
      line.setAttribute("y2",B.y);
      line.setAttribute("class","z-transition-line");
      line.setAttribute("marker-end","url(#arrowHead)");
      svg.append(line);
    }
  }

  points.forEach((p,index)=>{
    const {x,y}=pointXY(index,p);
    const text=document.createElementNS(svgNS,"text");
    text.setAttribute("x",x);
    text.setAttribute("y",y+6);
    text.setAttribute("text-anchor","middle");
    text.setAttribute("class","z-notation-number");
    text.textContent=p.tubo;
    if (interactive && onClick) {
      text.style.cursor="pointer";
      text.addEventListener("click",()=>onClick(index,p));
    }
    svg.append(text);

    if (Number(p.ev?.duracion)!==1 && p.kind!=="drag-end") {
      const dur=document.createElementNS(svgNS,"text");
      dur.setAttribute("x",x);
      dur.setAttribute("y",y-18);
      dur.setAttribute("text-anchor","middle");
      dur.setAttribute("class","z-duration-label");
      dur.textContent=`×${p.ev.duracion}`;
      svg.append(dur);
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

async function playEvent(ev) {
  if (ev.tipo === "arrastre") {
    const first=findTube(ev.desde.fila,ev.desde.tubo);
    const second=findTube(ev.hasta.fila,ev.hasta.tubo);
    if(first) playTube(first,true,.8);
    await new Promise(r=>setTimeout(r,260));
    if(second) playTube(second,true,.8);
    return;
  }
  const t=findTube(ev.fila,ev.tubo);
  if(t) playTube(t,true,ev.duracion);
}

async function playAll() {
  if(!currentRecord) return;
  const structure=getStructure(currentRecord);
  for(const item of structure) {
    if(item.tipo!=="parte") continue;
    for(const ev of item.eventos) {
      await playEvent(ev);
      await new Promise(r=>setTimeout(r,420*Math.max(.5,Number(ev.duracion)||1)));
    }
  }
}

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
