const $ = (q) => document.querySelector(q);

let songs = [];
let chordCatalog = [];
let currentFinger = 1;
let currentFingering = [];

function setStatus(el, text, type = "") {
  el.textContent = text;
  el.className = `status-message${type ? ` is-${type}` : ""}`;
}

function parseSequence(value) {
  return String(value || "")
    .split(/[\s,\-–—>→]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function joinSequence(arr) {
  return Array.isArray(arr) ? arr.join(" - ") : "";
}

async function ensureAdmin() {
  if (!window.CancioneroDB?.configured) {
    $("#loginView").hidden = false;
    $("#adminView").hidden = true;
    setStatus($("#loginStatus"), "Configura Supabase antes de entrar.", "error");
    return;
  }

  const session = await window.CancioneroDB.getSession();

  $("#loginView").hidden = Boolean(session);
  $("#adminView").hidden = !session;

  if (session) {
    $("#adminUser").textContent = session.user.email;
    await initAdmin();
  }
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus($("#loginStatus"), "Ingresando…");

  try {
    await window.CancioneroDB.signIn($("#loginEmail").value, $("#loginPassword").value);
    await ensureAdmin();
  } catch (error) {
    setStatus($("#loginStatus"), error.message, "error");
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await window.CancioneroDB.signOut();
  location.reload();
});

async function loadSongs() {
  songs = await window.CancioneroDB.listSongs();
  const select = $("#songSelect");
  select.replaceChildren();

  songs.forEach(song => {
    const opt = document.createElement("option");
    opt.value = song.id;
    opt.textContent = `${song.numero ? song.numero + " · " : ""}${song.titulo}`;
    select.append(opt);
  });
}

async function getSongRecord(songId) {
  const { data, error } = await window.CancioneroDB.client
    .from("charango_canciones")
    .select("*")
    .eq("cancion_id", songId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadSongRecord() {
  const songId = $("#songSelect").value;
  if (!songId) return;

  try {
    const data = await getSongRecord(songId);

    $("#songKey").value = data?.tonalidad || "";
    $("#songStrum").value = data?.rasgueo || "";
    $("#songPublished").checked = Boolean(data?.publicado);

    const s = data?.secciones || {};
    $("#secIntro").value = joinSequence(s.intro);
    $("#secVerso").value = joinSequence(s.verso);
    $("#secCoro").value = joinSequence(s.coro);
    $("#secPuente").value = joinSequence(s.puente);
    $("#secFinal").value = joinSequence(s.final);

    setStatus($("#songSaveStatus"), data ? "Ficha cargada." : "Esta canción todavía no tiene ficha.");
  } catch (error) {
    setStatus($("#songSaveStatus"), error.message, "error");
  }
}

$("#songSelect").addEventListener("change", loadSongRecord);

$("#saveSongRecord").addEventListener("click", async () => {
  const songId = $("#songSelect").value;
  if (!songId) return;

  const payload = {
    cancion_id: songId,
    tonalidad: $("#songKey").value.trim(),
    rasgueo: $("#songStrum").value.trim(),
    publicado: $("#songPublished").checked,
    secciones: {
      intro: parseSequence($("#secIntro").value),
      verso: parseSequence($("#secVerso").value),
      coro: parseSequence($("#secCoro").value),
      puente: parseSequence($("#secPuente").value),
      final: parseSequence($("#secFinal").value)
    },
    updated_at: new Date().toISOString()
  };

  setStatus($("#songSaveStatus"), "Guardando…");

  const { error } = await window.CancioneroDB.client
    .from("charango_canciones")
    .upsert(payload, { onConflict: "cancion_id" });

  if (error) setStatus($("#songSaveStatus"), error.message, "error");
  else setStatus($("#songSaveStatus"), "Ficha guardada correctamente.", "success");
});

async function loadChordCatalog() {
  const { data, error } = await window.CancioneroDB.client
    .from("charango_acordes")
    .select("*")
    .order("nombre");

  if (error) throw error;
  chordCatalog = data || [];
  renderChordList();
}

function renderChordList() {
  const q = $("#chordSearch").value.trim().toLowerCase();
  const list = $("#chordAdminList");
  list.replaceChildren();

  chordCatalog
    .filter(c => `${c.nombre} ${c.nombre_completo || ""}`.toLowerCase().includes(q))
    .forEach(chord => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chord-admin-item";
      btn.innerHTML = `<strong>${chord.nombre}</strong><span>${chord.nombre_completo || "Sin descripción"}${chord.publicado ? " · publicado" : ""}</span>`;
      btn.addEventListener("click", () => fillChord(chord));
      list.append(btn);
    });
}

$("#chordSearch").addEventListener("input", renderChordList);

function clearChordEditor() {
  $("#chordId").value = "";
  $("#chordName").value = "";
  $("#chordFullName").value = "";
  $("#chordNotes").value = "";
  $("#chordPublished").checked = false;
  $("#deleteChordBtn").hidden = true;
  currentFingering = [];
  document.querySelectorAll(".open-string-check").forEach(x => x.checked = false);
  renderAdminFretboard();
  setStatus($("#chordSaveStatus"), "");
}

$("#newChordBtn").addEventListener("click", clearChordEditor);
$("#clearChordBtn").addEventListener("click", clearChordEditor);

function fillChord(chord) {
  $("#chordId").value = chord.id;
  $("#chordName").value = chord.nombre || "";
  $("#chordFullName").value = chord.nombre_completo || "";
  $("#chordNotes").value = Array.isArray(chord.notas) ? chord.notas.join(", ") : "";
  $("#chordPublished").checked = Boolean(chord.publicado);
  $("#deleteChordBtn").hidden = false;

  currentFingering = Array.isArray(chord.digitacion)
    ? chord.digitacion.map(x => ({ orden: Number(x.orden), traste: Number(x.traste), dedo: Number(x.dedo) }))
    : [];

  const open = Array.isArray(chord.abiertas) ? chord.abiertas.map(Number) : [];
  document.querySelectorAll(".open-string-check").forEach(x => {
    x.checked = open.includes(Number(x.value));
  });

  renderAdminFretboard();
}

document.querySelectorAll(".finger-select").forEach(btn => {
  btn.addEventListener("click", () => {
    currentFinger = Number(btn.dataset.finger);
    document.querySelectorAll(".finger-select").forEach(x => x.classList.toggle("active", x === btn));
  });
});

function renderAdminFretboard() {
  const board = $("#adminFretboard");
  board.replaceChildren();

  for (let order = 1; order <= 5; order++) {
    for (let fret = 1; fret <= 5; fret++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "fret-cell";
      cell.dataset.order = order;
      cell.dataset.fret = fret;

      const found = currentFingering.find(x => x.orden === order && x.traste === fret);
      if (found) {
        cell.classList.add("has-finger");
        cell.textContent = found.dedo;
      }

      cell.addEventListener("click", () => {
        const idx = currentFingering.findIndex(x => x.orden === order && x.traste === fret);

        if (idx >= 0) currentFingering.splice(idx, 1);
        else {
          currentFingering = currentFingering.filter(x => x.orden !== order);
          currentFingering.push({ orden: order, traste: fret, dedo: currentFinger });
        }

        renderAdminFretboard();
      });

      board.append(cell);
    }
  }
}

$("#saveChordBtn").addEventListener("click", async () => {
  const name = $("#chordName").value.trim();
  if (!name) {
    setStatus($("#chordSaveStatus"), "Escribe el nombre del acorde.", "error");
    return;
  }

  const payload = {
    nombre: name,
    nombre_completo: $("#chordFullName").value.trim(),
    notas: $("#chordNotes").value.split(",").map(x => x.trim()).filter(Boolean),
    digitacion: currentFingering,
    abiertas: [...document.querySelectorAll(".open-string-check:checked")].map(x => Number(x.value)),
    publicado: $("#chordPublished").checked,
    updated_at: new Date().toISOString()
  };

  const id = $("#chordId").value;
  setStatus($("#chordSaveStatus"), "Guardando…");

  let query;
  if (id) query = window.CancioneroDB.client.from("charango_acordes").update(payload).eq("id", id);
  else query = window.CancioneroDB.client.from("charango_acordes").insert(payload);

  const { error } = await query;
  if (error) {
    setStatus($("#chordSaveStatus"), error.message, "error");
    return;
  }

  setStatus($("#chordSaveStatus"), "Acorde guardado.", "success");
  await loadChordCatalog();
});

$("#deleteChordBtn").addEventListener("click", async () => {
  const id = $("#chordId").value;
  if (!id) return;
  if (!confirm("¿Eliminar este acorde del catálogo?")) return;

  const { error } = await window.CancioneroDB.client
    .from("charango_acordes")
    .delete()
    .eq("id", id);

  if (error) setStatus($("#chordSaveStatus"), error.message, "error");
  else {
    clearChordEditor();
    await loadChordCatalog();
  }
});

async function initAdmin() {
  await loadSongs();
  await loadChordCatalog();
  renderAdminFretboard();
  await loadSongRecord();
}

ensureAdmin().catch(error => setStatus($("#loginStatus"), error.message, "error"));
