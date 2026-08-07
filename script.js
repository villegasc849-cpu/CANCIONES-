const listaCanciones = document.querySelector("#lista-canciones");
const buscador = document.querySelector("#buscador");
const contador = document.querySelector("#contador");
const sinResultados = document.querySelector("#sin-resultados");
const limpiarBusqueda = document.querySelector("#limpiar-busqueda");
const cerrarTodo = document.querySelector("#cerrar-todo");
const generarPdf = document.querySelector("#generar-pdf");
const estadoCarga = document.querySelector("#estado-carga");

let canciones = [];

let cancionAbierta = null;

function normalizarTexto(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function obtenerEnlaceYoutube(cancion) {
  const valor = cancion.youtube.trim();

  if (!valor) {
    return "";
  }

  let enlace = valor;

  if (!/^https?:\/\//i.test(valor)) {
    enlace = `https://www.youtube.com/watch?v=${encodeURIComponent(valor)}`;
  }

  try {
    const url = new URL(enlace);
    url.searchParams.delete("t");
    url.searchParams.delete("start");
    enlace = url.toString();
  } catch {
    // Keep the original value when it cannot be parsed as a URL.
  }

  const separador = enlace.includes("?") ? "&" : "?";
  const inicio = Number(cancion.inicio);

  return inicio > 0 ? `${enlace}${separador}t=${inicio}s` : enlace;
}

function obtenerVideoYoutube(cancion) {
  const enlace = obtenerEnlaceYoutube(cancion);

  if (!enlace) {
    return null;
  }

  try {
    const url = new URL(enlace);
    let videoId = "";

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] || "";
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] || "";
    } else {
      videoId = url.searchParams.get("v") || "";
    }

    if (!videoId) {
      return null;
    }

    const inicio = Math.max(0, Number(cancion.inicio) || 0);
    const parametros = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1"
    });

    if (inicio > 0) {
      parametros.set("start", String(inicio));
    }

    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      parametros.set("origin", window.location.origin);
    }

    return {
      externo: enlace,
      embed: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${parametros}`
    };
  } catch {
    return null;
  }
}

function crearReproductorYoutube(cancion) {
  const video = obtenerVideoYoutube(cancion);

  if (!video) {
    return null;
  }

  const seccion = document.createElement("section");
  seccion.className = "song__media";

  const boton = document.createElement("button");
  boton.className = "song__video-button";
  boton.type = "button";
  boton.textContent = "Ver video";

  const contenedor = document.createElement("div");
  contenedor.className = "song__player";
  contenedor.hidden = true;

  const ayuda = document.createElement("p");
  ayuda.className = "song__video-help";
  ayuda.append("Si el video no se reproduce aquí, ");

  const enlaceExterno = document.createElement("a");
  enlaceExterno.href = video.externo;
  enlaceExterno.target = "_blank";
  enlaceExterno.rel = "noopener noreferrer";
  enlaceExterno.textContent = "abrir en YouTube";
  ayuda.append(enlaceExterno, ".");

  boton.addEventListener("click", () => {
    const estaVisible = !contenedor.hidden;

    if (estaVisible) {
      contenedor.replaceChildren();
      contenedor.classList.remove("song__player--notice");
      contenedor.hidden = true;
      boton.textContent = "Ver video";
      boton.setAttribute("aria-expanded", "false");
      return;
    }

    if (window.location.protocol === "file:") {
      const aviso = document.createElement("div");
      aviso.className = "song__local-video-notice";

      const titulo = document.createElement("strong");
      titulo.textContent = "Vista local";

      const texto = document.createElement("p");
      texto.textContent =
        "YouTube no permite reproducir videos incrustados al abrir index.html directamente. En GitHub Pages funcionarán dentro de esta sección.";

      const enlace = document.createElement("a");
      enlace.href = video.externo;
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      enlace.textContent = "Ver ahora en YouTube";

      aviso.append(titulo, texto, enlace);
      contenedor.append(aviso);
      contenedor.classList.add("song__player--notice");
      contenedor.hidden = false;
      boton.textContent = "Ocultar aviso";
      boton.setAttribute("aria-expanded", "true");
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = video.embed;
    iframe.title = `Video de ${cancion.titulo}`;
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "origin-when-cross-origin";

    contenedor.classList.remove("song__player--notice");
    contenedor.append(iframe);
    contenedor.hidden = false;
    boton.textContent = "Ocultar video";
    boton.setAttribute("aria-expanded", "true");
  });

  boton.setAttribute("aria-expanded", "false");
  seccion.append(boton, contenedor, ayuda);
  return seccion;
}

function detenerVideoDeCancion(cancion) {
  const reproductor = cancion.querySelector(".song__player");
  const boton = cancion.querySelector(".song__video-button");

  if (!reproductor || !boton) {
    return;
  }

  reproductor.replaceChildren();
  reproductor.classList.remove("song__player--notice");
  reproductor.hidden = true;
  boton.textContent = "Ver video";
  boton.setAttribute("aria-expanded", "false");
}

function esIndicacionMusical(linea) {
  return /^\s*\(?\s*(coro|instrumental)\s*(?:…|\.{3})?\s*\)?\s*$/i.test(linea);
}

function crearLineaLetra(texto) {
  const linea = document.createElement("span");
  const patronDestacado = /(\(\s*bis\s*\)|\bbis\b)/gi;
  let posicion = 0;

  if (esIndicacionMusical(texto)) {
    const destacado = document.createElement("strong");
    destacado.className = "song__direction";
    destacado.textContent = texto;
    linea.append(destacado);
    return linea;
  }

  for (const coincidencia of texto.matchAll(patronDestacado)) {
    linea.append(document.createTextNode(texto.slice(posicion, coincidencia.index)));

    const destacado = document.createElement("strong");
    destacado.className = "song__repeat";
    destacado.textContent = coincidencia[0];
    linea.append(destacado);

    posicion = coincidencia.index + coincidencia[0].length;
  }

  linea.append(document.createTextNode(texto.slice(posicion)));
  return linea;
}

function crearEstrofas(texto) {
  const fragmento = document.createDocumentFragment();
  const lineas = texto.trim().split(/\r?\n/);
  let estrofa = [];

  function agregarEstrofa() {
    if (estrofa.length === 0) {
      return;
    }

    const bloque = document.createElement("p");
    bloque.className = "song__stanza";

    estrofa.forEach((linea) => bloque.append(crearLineaLetra(linea)));
    fragmento.append(bloque);
    estrofa = [];
  }

  lineas.forEach((lineaOriginal) => {
    const linea = lineaOriginal.trim();

    if (!linea) {
      agregarEstrofa();
      return;
    }

    if (esIndicacionMusical(linea)) {
      agregarEstrofa();
      estrofa.push(linea);
      agregarEstrofa();
      return;
    }

    estrofa.push(linea);

    if (/(\(\s*bis\s*\)|\bbis\b)/i.test(linea) || estrofa.length === 4) {
      agregarEstrofa();
    }
  });

  agregarEstrofa();
  return fragmento;
}

function crearCancion(cancion) {
  const articulo = document.createElement("article");
  const idContenido = `letra-${cancion.numero.replace(/\W/g, "-")}`;
  const reproductorYoutube = crearReproductorYoutube(cancion);

  articulo.className = "song";
  articulo.dataset.numero = cancion.numero;

  const boton = document.createElement("button");
  boton.className = "song__button";
  boton.type = "button";
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-controls", idContenido);

  const numero = document.createElement("span");
  numero.className = "song__number";
  numero.textContent = cancion.numero;

  const titulo = document.createElement("span");
  titulo.className = "song__title";
  titulo.textContent = cancion.titulo;

  const icono = document.createElement("span");
  icono.className = "song__chevron";
  icono.setAttribute("aria-hidden", "true");

  boton.append(numero, titulo, icono);

  const contenido = document.createElement("div");
  contenido.className = "song__content";
  contenido.id = idContenido;

  const contenidoInterior = document.createElement("div");
  contenidoInterior.className = "song__content-inner";

  const letra = document.createElement("div");
  letra.className = "song__lyrics";
  letra.append(crearEstrofas(cancion.letra));

  if (reproductorYoutube) {
    letra.append(reproductorYoutube);
  }

  contenidoInterior.append(letra);
  contenido.append(contenidoInterior);
  articulo.append(boton, contenido);

  boton.addEventListener("click", () => alternarCancion(articulo, boton, cancion.numero));

  return articulo;
}

function alternarCancion(articulo, boton, numeroCancion) {
  const estabaAbierta = cancionAbierta === numeroCancion;

  document.querySelectorAll(".song.is-open").forEach((cancion) => {
    detenerVideoDeCancion(cancion);
    cancion.classList.remove("is-open");
    cancion.querySelector(".song__button").setAttribute("aria-expanded", "false");
  });

  if (estabaAbierta) {
    cancionAbierta = null;
    return;
  }

  articulo.classList.add("is-open");
  boton.setAttribute("aria-expanded", "true");
  cancionAbierta = numeroCancion;
}

function cerrarTodasLasCanciones() {
  document.querySelectorAll(".song.is-open").forEach((cancion) => {
    detenerVideoDeCancion(cancion);
    cancion.classList.remove("is-open");
    cancion.querySelector(".song__button").setAttribute("aria-expanded", "false");
  });

  cancionAbierta = null;
}

function filtrarCanciones() {
  const consulta = normalizarTexto(buscador.value);
  const resultados = canciones.filter((cancion) => {
    const contenido = normalizarTexto(
      `${cancion.numero} ${cancion.titulo} ${cancion.letra}`
    );

    return contenido.includes(consulta);
  });

  renderizarCanciones(resultados);
  limpiarBusqueda.hidden = buscador.value.length === 0;
}

function renderizarCanciones(resultados) {
  listaCanciones.replaceChildren(...resultados.map(crearCancion));
  contador.textContent = `Mostrando ${resultados.length} de ${canciones.length} canciones`;
  sinResultados.hidden = resultados.length !== 0;
  listaCanciones.hidden = resultados.length === 0;

  if (!resultados.some((cancion) => cancion.numero === cancionAbierta)) {
    cancionAbierta = null;
  }
}

buscador.addEventListener("input", filtrarCanciones);

limpiarBusqueda.addEventListener("click", () => {
  buscador.value = "";
  filtrarCanciones();
  buscador.focus();
});

cerrarTodo.addEventListener("click", cerrarTodasLasCanciones);

async function cargarCanciones() {
  try {
    canciones = await window.CancioneroDB.listSongs();
    estadoCarga.hidden = true;
    renderizarCanciones(canciones);
  } catch (error) {
    console.error(error);
    estadoCarga.textContent = "No se pudieron cargar las canciones.";
  }
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[caracter]);
}

function generarLibro() {
  if (!canciones.length) return;

  const paginas = [
    {
      tipo: "portada",
      html: `<section class="book-cover">
        <div class="ornament">✥</div>
        <h1>Cancionero<br>Señor Cautivo</h1>
        <p>Ayabaca · Piura</p>
        <small>Fe, tradición y devoción</small>
      </section>`
    },
    ...canciones.map((cancion) => {
      const longitud = String(cancion.letra || "").length;
      const claseTamano = longitud > 1150 ? "very-long" : longitud > 850 ? "long" : longitud > 620 ? "medium" : "";
      return {
        tipo: "cancion",
        html: `<article class="print-song ${claseTamano}">
          <h2><span>${escaparHtml(cancion.numero)}</span> ${escaparHtml(cancion.titulo)}</h2>
          ${cancion.categoria ? `<p class="category">${escaparHtml(cancion.categoria)}</p>` : ""}
          <div class="lyrics">${escaparHtml(cancion.letra).replace(/\n/g, "<br>")}</div>
        </article>`
      };
    })
  ];

  while (paginas.length % 4 !== 0) {
    paginas.push({ tipo: "blanca", html: `<div class="blank-page"></div>` });
  }

  const hojas = paginas.length / 4;
  let contenido = "";

  // Imposición "cortar y apilar":
  // cada cuadrante forma un bloque consecutivo de páginas.
  for (let i = 0; i < hojas; i += 1) {
    const indices = [i, i + hojas, i + 2 * hojas, i + 3 * hojas];
    contenido += `<section class="print-sheet">`;
    indices.forEach((indice, posicion) => {
      const pagina = paginas[indice];
      contenido += `<div class="mini-page mini-page--${posicion + 1}">
        ${pagina.html}
        ${pagina.tipo !== "blanca" ? `<span class="page-number">${indice + 1}</span>` : ""}
      </div>`;
    });
    contenido += `</section>`;
  }

  const ventana = window.open("", "_blank");
  if (!ventana) {
    alert("Permite las ventanas emergentes para generar el libro.");
    return;
  }

  ventana.document.write(`<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Cancionero Señor Cautivo — 4 páginas por A4</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; color: #2F2A26; font-family: Georgia, "Times New Roman", serif; background: #fff; }

      .instructions {
        max-width: 900px; margin: 24px auto; padding: 20px 24px;
        border: 1px solid #D5C18E; border-radius: 14px; background: #fffaf0;
        font-family: Arial, sans-serif; line-height: 1.5;
      }
      .instructions h1 { margin-top: 0; color: #352448; }
      .instructions strong { color: #352448; }
      .instructions button {
        border: 0; border-radius: 10px; padding: 11px 18px; cursor: pointer;
        background: #4f3c70; color: white; font-weight: 700;
      }

      .print-sheet {
        width: 210mm; height: 297mm;
        display: grid;
        grid-template-columns: 105mm 105mm;
        grid-template-rows: 148.5mm 148.5mm;
        overflow: hidden;
        break-after: page; page-break-after: always;
      }
      .print-sheet:last-child { break-after: auto; page-break-after: auto; }

      .mini-page {
        width: 105mm; height: 148.5mm;
        position: relative; overflow: hidden;
        padding: 7.5mm 7mm 8mm;
        background: white;
      }
      .mini-page--1, .mini-page--3 { border-right: .25pt dashed #aaa; }
      .mini-page--1, .mini-page--2 { border-bottom: .25pt dashed #aaa; }

      .book-cover {
        height: 100%; display: flex; flex-direction: column;
        justify-content: center; align-items: center; text-align: center;
      }
      .book-cover .ornament { color: #A88A44; font-size: 18pt; margin-bottom: 5mm; }
      .book-cover h1 { color:#352448; font-size:22pt; line-height:1.05; margin:0; text-transform:uppercase; }
      .book-cover p { color:#A88A44; margin:6mm 0 2mm; letter-spacing:.18em; text-transform:uppercase; font:7.5pt Arial,sans-serif; }
      .book-cover small { font-size:7pt; }

      .print-song { height:100%; text-align:center; overflow:hidden; }
      .print-song h2 {
        color:#352448; border-bottom:.6pt solid #D5C18E;
        padding:0 0 2.5mm; margin:0 0 3mm; font-size:11.2pt; line-height:1.1;
      }
      .print-song h2 span { color:#A88A44; margin-right:1.5mm; }
      .print-song .lyrics { font-size:7.45pt; line-height:1.34; }
      .print-song.medium .lyrics { font-size:6.9pt; line-height:1.26; }
      .print-song.long .lyrics { font-size:6.25pt; line-height:1.18; }
      .print-song.very-long .lyrics { font-size:5.65pt; line-height:1.12; }
      .print-song.long h2, .print-song.very-long h2 { margin-bottom:2mm; font-size:10pt; }

      .category { color:#786F66; margin:-1.5mm 0 2mm; font:5.8pt Arial,sans-serif; text-transform:uppercase; letter-spacing:.1em; }
      .page-number { position:absolute; bottom:2.5mm; left:0; right:0; text-align:center; color:#777; font:5.5pt Arial,sans-serif; }
      .blank-page { height:100%; }

      @media print {
        .no-print { display:none !important; }
        body { background:white; }
      }
    </style>
  </head>
  <body>
    <section class="instructions no-print">
      <h1>Libro listo para cortar y engrapar</h1>
      <p>Se generaron <strong>${paginas.length} páginas A6</strong> distribuidas en <strong>${hojas} hojas A4</strong>, con cuatro páginas por hoja.</p>
      <p><strong>Imprime a una sola cara, escala 100 % y desactiva “Encabezados y pies de página”.</strong> Mantén las hojas en el mismo orden. Corta todo el bloque por la línea vertical y luego por la horizontal. Obtendrás cuatro montones. Apílalos así: <strong>superior izquierdo → superior derecho → inferior izquierdo → inferior derecho</strong>. Las páginas quedarán consecutivas y listas para engrapar por el borde izquierdo.</p>
      <button onclick="window.print()">Imprimir / Guardar como PDF</button>
    </section>
    ${contenido}
  </body>
  </html>`);

  ventana.document.close();
}

generarPdf.addEventListener("click", generarLibro);
cargarCanciones();
