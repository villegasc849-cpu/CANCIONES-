const $ = (q) => document.querySelector(q);

let songs = [];
let currentSong = null;
let currentRecord = null;
let chordCatalog = [];
let selectedChord = null;

function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function youtubeInfo(song) {
  const raw = String(song?.youtube || "").trim();
  if (!raw) return null;

  let urlString = raw;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://www.youtube.com/watch?v=${encodeURIComponent(urlString)}`;
  }

  try {
    const u = new URL(urlString);
    let id = "";

    if (u.hostname.includes("youtu.be")) id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    else id = u.searchParams.get("v") || "";

    const start = Math.max(0, Number(song.inicio) || 0);
    const external = new URL(urlString);
    external.searchParams.delete("t");
    external.searchParams.delete("start");
    if (start) external.searchParams.set("t", `${start}s`);

    if (!id) return { external: external.toString(), embed: "", start };

    const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
    if (start) params.set("start", String(start));
    if (location.protocol === "http:" || location.protocol === "https:") params.set("origin", location.origin);

    return {
      external: external.toString(),
      embed: `https://www.youtube.com/embed/${encodeURIComponent(id)}?${params}`,
      start
    };
  } catch {
    return null;
  }
}

function updateReference(song) {
  $("#songTitle").textContent = `${song.numero ? song.numero + " · " : ""}${song.titulo}`;
  $("#songMeta").textContent = song.categoria ? `${song.categoria} · datos compartidos con el cancionero` : "Datos compartidos con el cancionero";
  $("#referenceStart").textContent = `Inicio: ${formatTime(song.inicio)}`;

  const info = youtubeInfo(song);
  const btn = $("#referencePlayBtn");
  const yt = $("#youtubeBtn");
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");

  wrap.hidden = true;
  iframe.removeAttribute("src");
  btn.textContent = "▶ Escuchar referencia";

  if (!info) {
    btn.disabled = true;
    yt.hidden = true;
    btn.dataset.embed = "";
    return;
  }

  btn.disabled = !info.embed;
  btn.dataset.embed = info.embed || "";
  yt.hidden = false;
  yt.href = info.external;
}

$("#referencePlayBtn").addEventListener("click", () => {
  const btn = $("#referencePlayBtn");
  const wrap = $("#referencePlayerWrap");
  const iframe = $("#referencePlayer");
  const embed = btn.dataset.embed || "";
  if (!embed) return;

  if (!wrap.hidden) {
    wrap.hidden = true;
    iframe.removeAttribute("src");
    btn.textContent = "▶ Escuchar referencia";
  } else {
    iframe.src = embed;
    wrap.hidden = false;
    btn.textContent = "■ Ocultar referencia";
  }
});

function uniqueChords(record) {
  const sections = record?.secciones || {};
  return [...new Set(Object.values(sections).flat().filter(Boolean))];
}

function renderSections(record) {
  const container = $("#publicSections");
  container.replaceChildren();
  const labels = { intro: "Intro", verso: "Verso", coro: "Coro", puente: "Puente", final: "Final" };
  const sections = record?.secciones || {};

  Object.entries(labels).forEach(([key, label]) => {
    const values = Array.isArray(sections[key]) ? sections[key] : [];
    if (!values.length) return;

    const section = document.createElement("section");
    section.className = "public-section";
    const h3 = document.createElement("h3");
    h3.textContent = label;

    const row = document.createElement("div");
    row.className = "sequence public-sequence";

    values.forEach(name => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chord-chip";
      btn.textContent = name;
      btn.addEventListener("click", () => selectChord(name));
      row.append(btn);
    });

    section.append(h3, row);
    container.append(section);
  });
}

function renderUsedChords(record) {
  const used = uniqueChords(record);
  $("#publicChordCount").textContent = String(used.length);
  const container = $("#usedChords");
  container.replaceChildren();

  used.forEach(name => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chord-chip";
    btn.textContent = name;
    btn.addEventListener("click", () => selectChord(name));
    container.append(btn);
  });

  if (used.length) selectChord(used[0]);
}

function renderFretboard(data) {
  const board = $("#fretboard");
  board.replaceChildren();

  for (let s = 1; s <= 5; s++) {
    const label = document.createElement("span");
    label.className = "string-label";
    label.textContent = `${s}ª`;
    label.style.top = `${(s - .5) * 20}%`;
    board.append(label);
  }

  if (!data) return;

  const open = Array.isArray(data.abiertas) ? data.abiertas : [];
  open.forEach(string => {
    const dot = document.createElement("span");
    dot.className = "open-string";
    dot.style.left = "5%";
    dot.style.top = `${(Number(string) - .5) * 20}%`;
    board.append(dot);
  });

  const fingers = Array.isArray(data.digitacion) ? data.digitacion : [];
  fingers.forEach(item => {
    const string = Number(item.orden);
    const fret = Number(item.traste);
    const finger = Number(item.dedo);

    const dot = document.createElement("span");
    dot.className = "finger-dot";
    dot.textContent = finger || "●";
    dot.style.left = `${((fret - .5) / 6) * 100}%`;
    dot.style.top = `${(string - .5) * 20}%`;
    board.append(dot);
  });
}

function selectChord(name) {
  selectedChord = chordCatalog.find(x => x.nombre === name) || null;

  $("#selectedChordLabel").textContent = name || "—";
  $("#selectedChordName").textContent = selectedChord?.nombre_completo || "Digitación no publicada";
  $("#chordTones").textContent = Array.isArray(selectedChord?.notas) && selectedChord.notas.length ? selectedChord.notas.join(" · ") : "—";
  $("#playChordBtn").disabled = !selectedChord?.notas?.length;

  renderFretboard(selectedChord);
}

function frequencyForNote(note) {
  const map = { C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11 };
  const base = String(note).replace(/[0-9]/g,"");
  const midi = 60 + (map[base] ?? 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

$("#playChordBtn").addEventListener("click", () => {
  if (!selectedChord?.notas?.length) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;

  selectedChord.notas.forEach((note, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequencyForNote(note);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.10, now + .02 + i * .02);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 1.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * .025);
    osc.stop(now + 1.2);
  });
});

async function fetchPublicRecord(songId) {
  const client = window.CancioneroDB?.client;
  if (!client) return null;

  const { data, error } = await client
    .from("charango_canciones")
    .select("*")
    .eq("cancion_id", songId)
    .eq("publicado", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchChordCatalog() {
  const client = window.CancioneroDB?.client;
  if (!client) return [];

  const { data, error } = await client
    .from("charango_acordes")
    .select("*")
    .eq("publicado", true)
    .order("nombre");

  if (error) throw error;
  return data || [];
}

function showRecord(record) {
  currentRecord = record;
  const has = Boolean(record);

  $("#notPublished").hidden = has;
  $("#publicContent").hidden = !has;

  if (!has) {
    $("#publicStatus").textContent = "Sin ficha pública para esta canción";
    return;
  }

  $("#publicKey").textContent = record.tonalidad || "—";
  $("#publicStrum").textContent = record.rasgueo || "—";
  renderSections(record);
  renderUsedChords(record);
  $("#publicStatus").textContent = "Ficha pública cargada";
}

async function loadSelectedSong() {
  const id = $("#songSelect").value;
  currentSong = songs.find(s => String(s.id) === id) || songs.find(s => String(s.numero) === id) || songs[0];
  if (!currentSong) return;

  updateReference(currentSong);

  const url = new URL(location.href);
  url.searchParams.set("song", currentSong.id || currentSong.numero);
  history.replaceState(null, "", url);

  try {
    const record = await fetchPublicRecord(currentSong.id);
    showRecord(record);
  } catch (error) {
    console.error(error);
    showRecord(null);
    $("#publicStatus").textContent = "No se pudo cargar la ficha de Charango";
  }
}

async function init() {
  try {
    songs = await window.CancioneroDB.listSongs();
    chordCatalog = await fetchChordCatalog();

    const select = $("#songSelect");
    select.replaceChildren();

    songs.forEach(song => {
      const opt = document.createElement("option");
      opt.value = song.id;
      opt.textContent = `${song.numero ? song.numero + " · " : ""}${song.titulo}`;
      select.append(opt);
    });

    const requested = new URLSearchParams(location.search).get("song");
    if (requested && songs.some(s => String(s.id) === requested || String(s.numero) === requested)) {
      const match = songs.find(s => String(s.id) === requested || String(s.numero) === requested);
      select.value = match.id;
    }

    select.addEventListener("change", loadSelectedSong);
    await loadSelectedSong();
  } catch (error) {
    console.error(error);
    $("#publicStatus").textContent = error.message || "No se pudo cargar Charango";
  }
}

init();
