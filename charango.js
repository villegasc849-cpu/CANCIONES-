const ROOTS=["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const QUALITIES=["","6","7","9","maj7","m","m6","m7","m9","sus2","sus4","+","dim"];
const CHARANGO_CHORDS={G:{name:"Sol mayor",tones:["G","B","D"],fingers:[[1,2,2],[2,3,3],[3,1,1],[4,2,4]],open:[5]},D:{name:"Re mayor",tones:["D","F#","A"],fingers:[[1,2,1],[2,3,3],[3,2,2]],open:[4,5]},Em:{name:"Mi menor",tones:["E","G","B"],fingers:[[2,2,2],[3,2,3]],open:[1,4,5]},C:{name:"Do mayor",tones:["C","E","G"],fingers:[[2,1,1],[4,2,2]],open:[1,3,5]},Am:{name:"La menor",tones:["A","C","E"],fingers:[[2,1,1],[3,2,2]],open:[1,4,5]}};
const state={root:"G",selectedChord:"G",section:"intro",sequences:{intro:[],verso:[],coro:[],puente:[]},notes:{intro:"",verso:"",coro:"",puente:""},strum:"↓ ↓↑ ↑↓↑",strumNotes:"",status:"En aprendizaje",key:"G"};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function renderRootButtons(){const el=$("#rootButtons");el.replaceChildren();ROOTS.forEach(root=>{const b=document.createElement("button");b.textContent=root;b.classList.toggle("active",root===state.root);b.addEventListener("click",()=>{state.root=root;$("#familyTitle").textContent=root;renderRootButtons();renderQualityButtons()});el.append(b)})}
function renderQualityButtons(){const el=$("#qualityButtons");el.replaceChildren();QUALITIES.forEach(s=>{const chord=state.root+s;const b=document.createElement("button");b.textContent=chord;b.classList.toggle("active",chord===state.selectedChord);b.addEventListener("click",()=>{selectChord(chord);addChord(chord)});el.append(b)})}
function selectChord(chord){state.selectedChord=chord;renderQualityButtons();renderChordDetail()}
function addChord(chord){state.sequences[state.section].push(chord);renderSequence();renderUsedChords();markDirty()}
function renderSequence(){const el=$("#sequence"),arr=state.sequences[state.section];el.replaceChildren();el.classList.toggle("empty",!arr.length);arr.forEach((chord,i)=>{const b=document.createElement("button");b.className="chord-chip";b.textContent=chord;b.addEventListener("click",()=>selectChord(chord));b.addEventListener("dblclick",()=>{arr.splice(i,1);renderSequence();renderUsedChords();markDirty()});el.append(b)})}
function renderUsedChords(){const el=$("#usedChords"),unique=[...new Set(Object.values(state.sequences).flat())];el.replaceChildren();if(!unique.length){el.textContent="Todavía no has registrado acordes.";return}unique.forEach(chord=>{const b=document.createElement("button");b.className="chord-chip";b.textContent=chord;b.addEventListener("click",()=>selectChord(chord));el.append(b)})}
function renderChordDetail(){const chord=state.selectedChord,data=CHARANGO_CHORDS[chord];$("#selectedChordLabel").textContent=chord;$("#selectedChordName").textContent=data?data.name:"Digitación por completar";$("#chordTones").textContent=data?data.tones.join(" · "):"—";renderFretboard(data)}
function renderFretboard(data){const el=$("#fretboard");el.replaceChildren();for(let s=1;s<=5;s++){const l=document.createElement("span");l.className="string-label";l.textContent=`${s}ª`;l.style.top=`${(s-.5)*20}%`;el.append(l)}if(!data)return;(data.open||[]).forEach(string=>{const d=document.createElement("span");d.className="open-string";d.style.left="5%";d.style.top=`${(string-.5)*20}%`;el.append(d)});data.fingers.forEach(([string,fret,finger])=>{const d=document.createElement("span");d.className="finger-dot";d.textContent=finger;d.style.left=`${((fret-.5)/6)*100}%`;d.style.top=`${(string-.5)*20}%`;el.append(d)})}
function freq(note){const m={C:0,"C#":1,D:2,Eb:3,E:4,F:5,"F#":6,G:7,Ab:8,A:9,Bb:10,B:11};return 440*Math.pow(2,((60+(m[note]??0))-69)/12)}
function synthChord(chord){const data=CHARANGO_CHORDS[chord];if(!data){$("#saveStatus").textContent=`Aún falta registrar la digitación/sonido de ${chord}.`;return}const ctx=new (window.AudioContext||window.webkitAudioContext)(),now=ctx.currentTime;data.tones.forEach((note,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=freq(note);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.11,now+.02+i*.012);g.gain.exponentialRampToValueAtTime(.0001,now+1.2);o.connect(g).connect(ctx.destination);o.start(now+i*.025);o.stop(now+1.25)})}
function markDirty(){$("#saveStatus").textContent="Cambios sin guardar"}
$$('#sectionTabs button').forEach(btn=>btn.addEventListener('click',()=>{state.notes[state.section]=$("#sectionNotes").value;state.section=btn.dataset.section;$$('#sectionTabs button').forEach(x=>x.classList.toggle('active',x===btn));$("#sectionNotes").value=state.notes[state.section];renderSequence()}));
$("#undoChordBtn").addEventListener("click",()=>{state.sequences[state.section].pop();renderSequence();renderUsedChords();markDirty()});$("#clearChordBtn").addEventListener("click",()=>{state.sequences[state.section]=[];renderSequence();renderUsedChords();markDirty()});$("#sectionNotes").addEventListener("input",e=>{state.notes[state.section]=e.target.value;markDirty()});
$$('#strumOptions button').forEach(btn=>btn.addEventListener('click',()=>{$$('#strumOptions button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.strum=btn.dataset.pattern;markDirty()}));$("#strumNotes").addEventListener("input",e=>{state.strumNotes=e.target.value;markDirty()});
$("#playChordBtn").addEventListener("click",()=>synthChord(state.selectedChord));$("#earPlayBtn").addEventListener("click",()=>synthChord(state.selectedChord));
function qIndex(){return QUALITIES.findIndex(s=>state.root+s===state.selectedChord)}$("#prevChordBtn").addEventListener("click",()=>{let i=qIndex();if(i<0)i=0;i=(i-1+QUALITIES.length)%QUALITIES.length;selectChord(state.root+QUALITIES[i]);synthChord(state.selectedChord)});$("#nextChordBtn").addEventListener("click",()=>{let i=qIndex();if(i<0)i=0;i=(i+1)%QUALITIES.length;selectChord(state.root+QUALITIES[i]);synthChord(state.selectedChord)});
$("#keySelect").addEventListener("change",e=>{state.key=e.target.value;markDirty()});$("#statusSelect").addEventListener("change",e=>{state.status=e.target.value;markDirty()});

function youtubeInfo(song){
  const raw = String(song?.youtube || "").trim();
  if(!raw) return null;

  let urlString = raw;
  if(!/^https?:\/\//i.test(urlString)){
    urlString = `https://www.youtube.com/watch?v=${encodeURIComponent(urlString)}`;
  }

  try{
    const u = new URL(urlString);
    let videoId = "";

    if(u.hostname.includes("youtu.be")){
      videoId = u.pathname.split("/").filter(Boolean)[0] || "";
    }else if(u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")){
      videoId = u.pathname.split("/")[2] || "";
    }else{
      videoId = u.searchParams.get("v") || "";
    }

    if(!videoId) return { external:urlString, embed:"" };

    const start = Math.max(0, Number(song.inicio) || 0);
    const params = new URLSearchParams({
      rel:"0",
      modestbranding:"1",
      playsinline:"1"
    });
    if(start) params.set("start", String(start));
    if(location.protocol === "http:" || location.protocol === "https:"){
      params.set("origin", location.origin);
    }

    const external = new URL(urlString);
    external.searchParams.delete("t");
    external.searchParams.delete("start");
    if(start) external.searchParams.set("t", `${start}s`);

    return {
      external: external.toString(),
      embed: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`,
      start
    };
  }catch{
    return null;
  }
}

function formatTime(seconds){
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2,"0");
  return `${m}:${s}`;
}

let songList = [];
let currentSong = null;

function updateReference(song){
  currentSong = song || null;

  const title = $("#referenceTitle");
  const meta = $("#referenceMeta");
  const startEl = $("#referenceStart");
  const playBtn = $("#referencePlayBtn");
  const youtubeBtn = $("#referenceYoutubeBtn");
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");

  if(!song){
    title.textContent = "Selecciona una canción";
    meta.textContent = "El enlace y el segundo de inicio vienen directamente del cancionero.";
    startEl.textContent = "Inicio: 0:00";
    playBtn.disabled = true;
    youtubeBtn.hidden = true;
    wrap.hidden = true;
    iframe.removeAttribute("src");
    return;
  }

  title.textContent = `${song.numero ? song.numero + " · " : ""}${song.titulo}`;
  meta.textContent = song.categoria
    ? `${song.categoria} · datos compartidos con el cancionero`
    : "Datos compartidos con el cancionero";

  const info = youtubeInfo(song);
  startEl.textContent = `Inicio: ${formatTime(song.inicio)}`;

  if(!info){
    playBtn.disabled = true;
    youtubeBtn.hidden = true;
    wrap.hidden = true;
    iframe.removeAttribute("src");
    return;
  }

  playBtn.disabled = !info.embed;
  youtubeBtn.hidden = false;
  youtubeBtn.href = info.external;

  playBtn.dataset.embed = info.embed || "";
}

function toggleReference(){
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");
  const btn = $("#referencePlayBtn");
  const embed = btn.dataset.embed || "";

  if(!embed) return;

  if(!wrap.hidden){
    wrap.hidden = true;
    iframe.removeAttribute("src");
    btn.textContent = "▶ Escuchar referencia";
    return;
  }

  iframe.src = embed;
  wrap.hidden = false;
  btn.textContent = "■ Ocultar referencia";
}

$("#referencePlayBtn").addEventListener("click", toggleReference);

function recordKey(songId){
  return `charango_record_${songId || "sin-id"}`;
}

function saveCurrentRecord(){
  state.notes[state.section] = $("#sectionNotes").value;

  const songId = $("#songSelect").value;
  const payload = {
    songId,
    key: state.key,
    status: state.status,
    strum: state.strum,
    strumNotes: state.strumNotes,
    sequences: state.sequences,
    notes: state.notes
  };

  try{
    localStorage.setItem(recordKey(songId), JSON.stringify(payload));
    $("#saveStatus").textContent = "Guardado para esta canción";
  }catch{
    $("#saveStatus").textContent = "No se pudo guardar localmente";
  }
}

function resetMusicalState(){
  state.section = "intro";
  state.sequences = {intro:[],verso:[],coro:[],puente:[]};
  state.notes = {intro:"",verso:"",coro:"",puente:""};
  state.strum = "↓ ↓↑ ↑↓↑";
  state.strumNotes = "";
  state.status = "En aprendizaje";
  state.key = "G";

  $("#keySelect").value = "G";
  $("#statusSelect").value = "En aprendizaje";
  $("#sectionNotes").value = "";
  $("#strumNotes").value = "";

  document.querySelectorAll("#sectionTabs button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.section === "intro");
  });
  document.querySelectorAll("#strumOptions button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.pattern === state.strum);
  });

  renderSequence();
  renderUsedChords();
}

function loadRecordForSong(songId){
  resetMusicalState();

  try{
    const raw = localStorage.getItem(recordKey(songId));
    if(!raw){
      $("#saveStatus").textContent = "Sin registro de charango todavía";
      return;
    }

    const data = JSON.parse(raw);

    state.key = data.key || "G";
    state.status = data.status || "En aprendizaje";
    state.strum = data.strum || "↓ ↓↑ ↑↓↑";
    state.strumNotes = data.strumNotes || "";
    state.sequences = {
      intro:[...(data.sequences?.intro || [])],
      verso:[...(data.sequences?.verso || [])],
      coro:[...(data.sequences?.coro || [])],
      puente:[...(data.sequences?.puente || [])]
    };
    state.notes = {
      intro:data.notes?.intro || "",
      verso:data.notes?.verso || "",
      coro:data.notes?.coro || "",
      puente:data.notes?.puente || ""
    };

    $("#keySelect").value = state.key;
    $("#statusSelect").value = state.status;
    $("#strumNotes").value = state.strumNotes;
    $("#sectionNotes").value = state.notes.intro;

    document.querySelectorAll("#strumOptions button").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.pattern === state.strum);
    });

    renderSequence();
    renderUsedChords();
    $("#saveStatus").textContent = "Registro cargado";
  }catch{
    $("#saveStatus").textContent = "No se pudo leer el registro guardado";
  }
}

$("#saveBtn").addEventListener("click", saveCurrentRecord);

async function loadSongs(){
  const select = $("#songSelect");
  select.replaceChildren();

  try{
    if(window.CancioneroDB?.listSongs){
      songList = await window.CancioneroDB.listSongs();
    }
  }catch(error){
    console.error("No se pudieron cargar canciones desde Supabase:", error);
  }

  if(!songList.length){
    songList = (window.CANCIONES_INICIALES || []).map((song,index)=>({
      ...song,
      id:song.id || song.numero || String(index+1)
    }));
  }

  songList.forEach(song=>{
    const option = document.createElement("option");
    option.value = song.id || song.numero || song.titulo;
    option.textContent = `${song.numero ? song.numero+" · " : ""}${song.titulo}`;
    select.append(option);
  });

  if(!songList.length){
    const option = document.createElement("option");
    option.textContent = "No hay canciones disponibles";
    option.value = "";
    select.append(option);
    updateReference(null);
    return;
  }

  const querySong = new URLSearchParams(location.search).get("song");
  const requested = querySong
    ? songList.find(song => String(song.id || song.numero) === querySong || String(song.numero) === querySong)
    : null;

  const first = requested || songList[0];
  select.value = first.id || first.numero || first.titulo;

  updateReference(first);
  loadRecordForSong(select.value);
}

$("#songSelect").addEventListener("change", ()=>{
  const selected = songList.find(song => String(song.id || song.numero || song.titulo) === $("#songSelect").value);
  updateReference(selected);
  loadRecordForSong($("#songSelect").value);

  const url = new URL(location.href);
  if(selected) url.searchParams.set("song", selected.id || selected.numero);
  history.replaceState(null,"",url);
});

renderRootButtons();
renderQualityButtons();
renderSequence();
renderUsedChords();
renderChordDetail();
loadSongs();
