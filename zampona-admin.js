const $ = (q) => document.querySelector(q);

let songs = [];
let tubes = [];
let tubeRecording = false;

function setStatus(el,text,type=""){
  el.textContent = text;
  el.className = `status-message${type ? ` is-${type}` : ""}`;
}
function parseSequence(value){
  const raw=String(value || "").trim();
  if(!raw) return [];
  if(raw.startsWith("#")) return [raw];
  return raw.split(/[\s,;|]+/).map(x=>x.trim()).filter(Boolean);
}
function joinSequence(arr){ return Array.isArray(arr) ? arr.join(" ") : ""; }

async function ensureAdmin(){
  if(!window.CancioneroDB?.configured){
    $("#loginView").hidden=false;
    $("#adminView").hidden=true;
    setStatus($("#loginStatus"),"Configura Supabase antes de entrar.","error");
    return;
  }
  const session=await window.CancioneroDB.getSession();
  $("#loginView").hidden=Boolean(session);
  $("#adminView").hidden=!session;
  if(session){
    $("#adminUser").textContent=session.user.email;
    await initAdmin();
  }
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  setStatus($("#loginStatus"),"Ingresando…");
  try{
    await window.CancioneroDB.signIn($("#loginEmail").value,$("#loginPassword").value);
    await ensureAdmin();
  }catch(error){ setStatus($("#loginStatus"),error.message,"error"); }
});
$("#logoutBtn").addEventListener("click",async()=>{ await window.CancioneroDB.signOut(); location.reload(); });

async function loadSongs(){
  songs=await window.CancioneroDB.listSongs();
  const select=$("#songSelect");
  select.replaceChildren();
  songs.forEach(song=>{
    const opt=document.createElement("option");
    opt.value=song.id;
    opt.textContent=`${song.numero ? song.numero+" · " : ""}${song.titulo}`;
    select.append(opt);
  });
}

async function getSongRecord(songId){
  const {data,error}=await window.CancioneroDB.client.from("zampona_canciones").select("*").eq("cancion_id",songId).maybeSingle();
  if(error) throw error;
  return data;
}

async function loadSongRecord(){
  const songId=$("#songSelect").value;
  if(!songId) return;
  try{
    const data=await getSongRecord(songId);
    $("#songScale").value=data?.escala || "";
    $("#songTempo").value=data?.tempo || "";
    $("#songPublished").checked=Boolean(data?.publicado);
    const s=data?.secciones || {};
    $("#secIntro").value=joinSequence(s.intro);
    $("#secVerso").value=joinSequence(s.verso);
    $("#secCoro").value=joinSequence(s.coro);
    $("#secPuente").value=joinSequence(s.puente);
    $("#secFinal").value=joinSequence(s.final);
    setStatus($("#songSaveStatus"),data ? "Ficha cargada." : "Esta canción todavía no tiene ficha.");
  }catch(error){ setStatus($("#songSaveStatus"),error.message,"error"); }
}
$("#songSelect").addEventListener("change",loadSongRecord);

$("#saveSongRecord").addEventListener("click",async()=>{
  const songId=$("#songSelect").value;
  if(!songId) return;
  const payload={
    cancion_id:songId,
    escala:$("#songScale").value.trim(),
    tempo:$("#songTempo").value ? Number($("#songTempo").value) : null,
    publicado:$("#songPublished").checked,
    secciones:{
      intro:parseSequence($("#secIntro").value),
      verso:parseSequence($("#secVerso").value),
      coro:parseSequence($("#secCoro").value),
      puente:parseSequence($("#secPuente").value),
      final:parseSequence($("#secFinal").value)
    },
    updated_at:new Date().toISOString()
  };
  setStatus($("#songSaveStatus"),"Guardando…");
  const {error}=await window.CancioneroDB.client.from("zampona_canciones").upsert(payload,{onConflict:"cancion_id"});
  if(error) setStatus($("#songSaveStatus"),error.message,"error");
  else setStatus($("#songSaveStatus"),"Ficha guardada correctamente.","success");
});

function defaultTubeRows(){
  const rows=[];
  for(let i=1;i<=12;i++) rows.push({fila:"superior",posicion:i});
  for(let i=1;i<=11;i++) rows.push({fila:"inferior",posicion:i});
  return rows;
}
async function loadTubes(){
  const {data,error}=await window.CancioneroDB.client.from("zampona_tubos").select("*").order("fila").order("posicion");
  if(error) throw error;
  tubes=data || [];
  renderTubeList();
  renderAdminMap();
}
function tubeHeight(position,row){
  const max=row==="superior" ? 12 : 11;
  const minH=85,maxH=220;
  const ratio=(position-1)/(max-1);
  return Math.round(maxH-ratio*(maxH-minH));
}
function getTubeAt(row,pos){ return tubes.find(t=>t.fila===row && Number(t.posicion)===Number(pos)); }

function renderAdminMap(){
  const upper=$("#adminUpperRow"),lower=$("#adminLowerRow");
  upper.replaceChildren(); lower.replaceChildren();
  defaultTubeRows().forEach(slot=>{
    const existing=getTubeAt(slot.fila,slot.posicion);
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="zampona-admin-tube";
    btn.style.height=`${tubeHeight(slot.posicion,slot.fila)}px`;
    if(existing?.id===$("#tubeId").value) btn.classList.add("selected");
    const span=document.createElement("span");
    span.textContent=existing?.etiqueta || existing?.numero || slot.posicion;
    btn.append(span);
    btn.addEventListener("click",()=>{ if(tubeRecording && existing){ appendTubeToSection(existing); playFrequency(existing.frecuencia); flashAdminTube(btn); } else existing ? fillTube(existing) : fillEmptySlot(slot); });
    (slot.fila==="superior" ? upper : lower).append(btn);
  });
}

function renderTubeList(){
  const list=$("#tubeList");
  list.replaceChildren();
  defaultTubeRows().forEach(slot=>{
    const existing=getTubeAt(slot.fila,slot.posicion);
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="zampona-tube-admin-item";
    const title=existing ? `${slot.fila==="superior" ? "S" : "I"}${slot.posicion} · ${existing.etiqueta || existing.numero || "sin etiqueta"}` : `${slot.fila==="superior" ? "S" : "I"}${slot.posicion} · sin configurar`;
    btn.innerHTML=`<strong>${title}</strong><span>${existing?.nota || "Sin nota"}${existing?.frecuencia ? " · "+Number(existing.frecuencia).toFixed(2)+" Hz" : ""}</span>`;
    btn.addEventListener("click",()=>existing ? fillTube(existing) : fillEmptySlot(slot));
    list.append(btn);
  });
}

const SEMITONES={C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11};

function frequencyFor(pitch,octave){
  if(!(pitch in SEMITONES)) return null;
  const midi=(Number(octave)+1)*12+SEMITONES[pitch];
  return 440*Math.pow(2,(midi-69)/12);
}

function parseStoredNote(note){
  const m=String(note || "").match(/^([A-G](?:#)?)(-?\d+)$/);
  if(!m) return {pitch:"",octave:4};
  return {pitch:m[1],octave:Number(m[2])};
}

function calculatedFrequency(){
  const pitch=$("#tubePitch").value;
  const octave=Number($("#tubeOctave").value);
  return frequencyFor(pitch,octave);
}

function effectiveFrequency(){
  if($("#useCustomFrequency").checked){
    const custom=Number($("#customFrequency").value);
    return custom>0 ? custom : null;
  }
  return calculatedFrequency();
}

function updateFrequencyUI(){
  const auto=calculatedFrequency();
  $("#autoFrequency").textContent=auto ? `${auto.toFixed(2)} Hz` : "— Hz";
  $("#customFrequency").disabled=!$("#useCustomFrequency").checked;
}
$("#tubePitch").addEventListener("change",updateFrequencyUI);
$("#tubeOctave").addEventListener("change",updateFrequencyUI);
$("#useCustomFrequency").addEventListener("change",updateFrequencyUI);

function fillEmptySlot(slot){
  $("#tubeId").value="";
  $("#tubeRow").value=slot.fila;
  $("#tubePosition").value=slot.posicion;
  $("#tubeNumber").value="";
  $("#tubeLabel").value="";
  $("#tubePitch").value="";
  $("#tubeOctave").value="4";
  $("#useCustomFrequency").checked=false;
  $("#customFrequency").value="";
  $("#tubePublished").checked=false;
  updateFrequencyUI();
  renderAdminMap();
  setStatus($("#tubeSaveStatus"),"Tubo nuevo: define sus datos.");
}

function fillTube(tube){
  $("#tubeId").value=tube.id;
  $("#tubeRow").value=tube.fila;
  $("#tubePosition").value=tube.posicion;
  $("#tubeNumber").value=tube.numero || "";
  $("#tubeLabel").value=tube.etiqueta || "";

  const parsed=parseStoredNote(tube.nota);
  $("#tubePitch").value=parsed.pitch;
  $("#tubeOctave").value=String(parsed.octave);

  const auto=frequencyFor(parsed.pitch,parsed.octave);
  const stored=Number(tube.frecuencia);
  const custom=stored && auto && Math.abs(stored-auto)>.5;
  $("#useCustomFrequency").checked=Boolean(custom);
  $("#customFrequency").value=custom ? stored.toFixed(2) : "";

  $("#tubePublished").checked=Boolean(tube.publicado);
  updateFrequencyUI();
  renderAdminMap();
}

function playFrequency(freq){
  const value=Number(freq);
  if(!value || value<=0){
    setStatus($("#tubeSaveStatus"),"Selecciona una nota y octava válidas, o usa una frecuencia personalizada.","error");
    return;
  }
  const ctx=new (window.AudioContext || window.webkitAudioContext)();
  const now=ctx.currentTime;
  const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
  osc.type="sine"; osc.frequency.value=value;
  filter.type="lowpass"; filter.frequency.value=1800;
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.13,now+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.75);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now); osc.stop(now+.8);
}

$("#playTubeBtn").addEventListener("click",()=>playFrequency(effectiveFrequency()));

$("#saveTubeBtn").addEventListener("click",async()=>{
  const row=$("#tubeRow").value;
  const position=Number($("#tubePosition").value);
  const max=row==="superior" ? 12 : 11;
  if(!position || position<1 || position>max){
    setStatus($("#tubeSaveStatus"),`La fila ${row} admite posiciones del 1 al ${max}.`,"error");
    return;
  }

  const pitch=$("#tubePitch").value;
  const octave=Number($("#tubeOctave").value);
  const freq=effectiveFrequency();

  if(!pitch || !freq){
    setStatus($("#tubeSaveStatus"),"Selecciona nota y octava antes de guardar.","error");
    return;
  }

  const payload={
    fila:row,
    posicion:position,
    numero:$("#tubeNumber").value.trim(),
    etiqueta:$("#tubeLabel").value.trim(),
    nota:`${pitch}${octave}`,
    frecuencia:Number(freq.toFixed(4)),
    publicado:$("#tubePublished").checked,
    updated_at:new Date().toISOString()
  };

  const id=$("#tubeId").value;
  setStatus($("#tubeSaveStatus"),"Guardando…");
  let query;
  if(id) query=window.CancioneroDB.client.from("zampona_tubos").update(payload).eq("id",id);
  else query=window.CancioneroDB.client.from("zampona_tubos").insert(payload);

  const {error}=await query;
  if(error){
    setStatus($("#tubeSaveStatus"),error.message,"error");
    return;
  }

  setStatus($("#tubeSaveStatus"),"Tubo guardado correctamente.","success");
  await loadTubes();
  const saved=getTubeAt(row,position);
  if(saved) fillTube(saved);
});

function sectionInput(key){ return $("#sec"+key.charAt(0).toUpperCase()+key.slice(1)); }
function appendTubeToSection(tube){ const input=sectionInput($("#recordSection").value); if(!input)return; const token=tube.etiqueta||tube.numero||tube.posicion; input.value=(input.value+" "+token).trim(); input.dispatchEvent(new Event("input")); }
function flashAdminTube(el){ el.classList.add("is-playing"); setTimeout(()=>el.classList.remove("is-playing"),350); }
$("#toggleTubeRecording")?.addEventListener("click",()=>{tubeRecording=!tubeRecording; const b=$("#toggleTubeRecording"); b.classList.toggle("active",tubeRecording); b.textContent=tubeRecording?"● Registrando: toca los tubos":"● Activar registro por tubos";});
$("#undoTubeNote")?.addEventListener("click",()=>{const input=sectionInput($("#recordSection").value); if(!input)return; const a=parseSequence(input.value);a.pop();input.value=a.join(" ");});

async function initAdmin(){
  await loadSongs();
  await loadTubes();
  await loadSongRecord();
  if(!$("#tubeId").value) fillEmptySlot({fila:"superior",posicion:1});
}
ensureAdmin().catch(error=>setStatus($("#loginStatus"),error.message,"error"));
