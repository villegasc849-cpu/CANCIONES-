const $ = (q) => document.querySelector(q);

let songs = [];
let tubes = [];
let currentSong = null;
let currentRecord = null;

function formatTime(seconds){
  const total = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;
}

function youtubeInfo(song){
  const raw = String(song?.youtube || "").trim();
  if(!raw) return null;

  let urlString = raw;
  if(!/^https?:\/\//i.test(urlString)){
    urlString = `https://www.youtube.com/watch?v=${encodeURIComponent(urlString)}`;
  }

  try{
    const u = new URL(urlString);
    let id = "";

    if(u.hostname.includes("youtu.be")) id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if(u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    else id = u.searchParams.get("v") || "";

    const start = Math.max(0, Number(song.inicio) || 0);
    const external = new URL(urlString);
    external.searchParams.delete("t");
    external.searchParams.delete("start");
    if(start) external.searchParams.set("t", `${start}s`);

    if(!id) return {external:external.toString(),embed:"",start};

    const params = new URLSearchParams({rel:"0",modestbranding:"1",playsinline:"1"});
    if(start) params.set("start",String(start));
    if(location.protocol === "http:" || location.protocol === "https:"){
      params.set("origin",location.origin);
    }

    return {
      external:external.toString(),
      embed:`https://www.youtube.com/embed/${encodeURIComponent(id)}?${params.toString()}`,
      start
    };
  }catch{
    return null;
  }
}

function updateReference(song){
  $("#songTitle").textContent = `${song.numero ? song.numero+" · " : ""}${song.titulo}`;
  $("#songMeta").textContent = song.categoria
    ? `${song.categoria} · datos compartidos con el cancionero`
    : "Datos compartidos con el cancionero";

  $("#referenceStart").textContent = `Inicio: ${formatTime(song.inicio)}`;

  const info = youtubeInfo(song);
  const btn = $("#referencePlayBtn");
  const yt = $("#youtubeBtn");
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");

  wrap.hidden = true;
  iframe.removeAttribute("src");
  btn.textContent = "▶ Escuchar referencia";

  if(!info){
    btn.disabled = true;
    btn.dataset.embed = "";
    yt.hidden = true;
    return;
  }

  btn.disabled = !info.embed;
  btn.dataset.embed = info.embed || "";
  yt.hidden = false;
  yt.href = info.external;
}

$("#referencePlayBtn").addEventListener("click",()=>{
  const btn = $("#referencePlayBtn");
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");
  const embed = btn.dataset.embed || "";
  if(!embed) return;

  if(!wrap.hidden){
    wrap.hidden = true;
    iframe.removeAttribute("src");
    btn.textContent = "▶ Escuchar referencia";
  }else{
    iframe.src = embed;
    wrap.hidden = false;
    btn.textContent = "■ Ocultar referencia";
  }
});

function tubeHeight(position,row){
  const max = row === "superior" ? 12 : 11;
  const minH = 92;
  const maxH = 232;
  const ratio = max <= 1 ? 1 : (position-1)/(max-1);
  return Math.round(maxH - ratio*(maxH-minH));
}

function renderTube(tube){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "zampona-tube";
  btn.style.height = `${tubeHeight(Number(tube.posicion),tube.fila)}px`;
  btn.dataset.tubeId = tube.id;

  const cap = document.createElement("span");
  cap.className = "zampona-tube__cap";

  const note = document.createElement("span");
  note.className = "zampona-tube__note";
  note.textContent = tube.nota || "";

  const label = document.createElement("span");
  label.className = "zampona-tube__label";
  label.textContent = tube.etiqueta || tube.numero || tube.posicion;

  btn.append(cap,note,label);
  btn.addEventListener("click",()=>playTube(tube,true));
  return btn;
}

function renderInstrument(){
  const upper = $("#upperRow");
  const lower = $("#lowerRow");
  upper.replaceChildren();
  lower.replaceChildren();

  tubes
    .filter(t=>t.fila==="superior")
    .sort((a,b)=>a.posicion-b.posicion)
    .forEach(t=>upper.append(renderTube(t)));

  tubes
    .filter(t=>t.fila==="inferior")
    .sort((a,b)=>a.posicion-b.posicion)
    .forEach(t=>lower.append(renderTube(t)));

  $("#publicTubeCount").textContent = `${tubes.length} / 23`;
}

function highlightTube(tube){
  document.querySelectorAll(".zampona-tube").forEach(x=>x.classList.remove("is-active"));
  const el = document.querySelector(`[data-tube-id="${tube.id}"]`);
  if(el){
    el.classList.add("is-active");
    el.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
    setTimeout(()=>el.classList.remove("is-active"),650);
  }
}

function playFrequency(freq){
  const value = Number(freq);
  if(!value || value<=0) return;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.value = value;
  filter.type = "lowpass";
  filter.frequency.value = 1800;

  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.13,now+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.75);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now+.8);
}

function playTube(tube,highlight=false){
  if(highlight) highlightTube(tube);
  playFrequency(tube.frecuencia);
}

function findTube(token){
  const key = String(token || "").trim().toLowerCase();
  return tubes.find(t =>
    String(t.id)===key ||
    String(t.numero || "").toLowerCase()===key ||
    String(t.etiqueta || "").toLowerCase()===key ||
    String(t.nota || "").toLowerCase()===key
  );
}

function renderSections(record){
  const container = $("#publicSections");
  container.replaceChildren();
  const labels = {intro:"Intro",verso:"Verso",coro:"Coro",puente:"Puente",final:"Final"};
  const sections = record?.secciones || {};

  Object.entries(labels).forEach(([key,label])=>{
    const values = Array.isArray(sections[key]) ? sections[key] : [];
    if(!values.length) return;

    const section = document.createElement("section");
    section.className = "zampona-section";

    const h3 = document.createElement("h3");
    h3.textContent = label;

    const row = document.createElement("div");
    row.className = "zampona-sequence";

    values.forEach(token=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zampona-note-chip";
      btn.textContent = token;
      btn.addEventListener("click",()=>{
        const tube = findTube(token);
        if(tube) playTube(tube,true);
      });
      row.append(btn);
    });

    section.append(h3,row);
    container.append(section);
  });
}

async function fetchPublicRecord(songId){
  const client = window.CancioneroDB?.client;
  if(!client) return null;

  const {data,error} = await client
    .from("zampona_canciones")
    .select("*")
    .eq("cancion_id",songId)
    .eq("publicado",true)
    .maybeSingle();

  if(error) throw error;
  return data;
}

async function fetchTubes(){
  const client = window.CancioneroDB?.client;
  if(!client) return [];

  const {data,error} = await client
    .from("zampona_tubos")
    .select("*")
    .eq("publicado",true)
    .order("fila")
    .order("posicion");

  if(error) throw error;
  return data || [];
}

function showRecord(record){
  currentRecord = record;
  const has = Boolean(record);

  $("#notPublished").hidden = has;
  $("#publicContent").hidden = !has;

  if(!has){
    $("#publicStatus").textContent = "Sin ficha pública para esta canción";
    return;
  }

  $("#publicScale").textContent = record.escala || "—";
  $("#publicTempo").textContent = record.tempo ? `${record.tempo} BPM` : "—";
  renderSections(record);
  renderInstrument();
  $("#publicStatus").textContent = "Ficha pública cargada";
}

async function loadSelectedSong(){
  const id = $("#songSelect").value;
  currentSong = songs.find(s=>String(s.id)===id) || songs[0];
  if(!currentSong) return;

  updateReference(currentSong);

  const url = new URL(location.href);
  url.searchParams.set("song",currentSong.id || currentSong.numero);
  history.replaceState(null,"",url);

  try{
    const record = await fetchPublicRecord(currentSong.id);
    showRecord(record);
  }catch(error){
    console.error(error);
    showRecord(null);
    $("#publicStatus").textContent = "No se pudo cargar la ficha de Zampoña";
  }
}

async function init(){
  try{
    songs = await window.CancioneroDB.listSongs();
    tubes = await fetchTubes();

    const select = $("#songSelect");
    select.replaceChildren();

    songs.forEach(song=>{
      const opt = document.createElement("option");
      opt.value = song.id;
      opt.textContent = `${song.numero ? song.numero+" · " : ""}${song.titulo}`;
      select.append(opt);
    });

    const requested = new URLSearchParams(location.search).get("song");
    if(requested){
      const match = songs.find(s=>String(s.id)===requested || String(s.numero)===requested);
      if(match) select.value = match.id;
    }

    select.addEventListener("change",loadSelectedSong);
    await loadSelectedSong();
  }catch(error){
    console.error(error);
    $("#publicStatus").textContent = error.message || "No se pudo cargar Zampoña";
  }
}

init();
