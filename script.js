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
    // Mantiene el valor original si no puede interpretarse como URL.
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

    if (
      window.location.protocol === "http:" ||
      window.location.protocol === "https:"
    ) {
      parametros.set("origin", window.location.origin);
    }

    return {
      externo: enlace,
      embed: `https://www.youtube.com/embed/${encodeURIComponent(
        videoId
      )}?${parametros}`
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

    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "origin-when-cross-origin";

    contenedor.classList.remove("song__player--notice");
    contenedor.append(iframe);
    contenedor.hidden = false;

    boton.textContent = "Ocultar video";
    boton.setAttribute("aria-expanded", "true");
  });

  boton.setAttribute("aria-expanded", "false");

  seccion.append(
    boton,
    contenedor,
    ayuda
  );

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
  return /^\s*\(?\s*(coro|instrumental)\s*(?:…|\.{3})?\s*\)?\s*$/i.test(
    linea
  );
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
    linea.append(
      document.createTextNode(
        texto.slice(
          posicion,
          coincidencia.index
        )
      )
    );

    const destacado = document.createElement("strong");

    destacado.className = "song__repeat";
    destacado.textContent = coincidencia[0];

    linea.append(destacado);

    posicion =
      coincidencia.index +
      coincidencia[0].length;
  }

  linea.append(
    document.createTextNode(
      texto.slice(posicion)
    )
  );

  return linea;
}

function crearEstrofas(texto) {
  const fragmento =
    document.createDocumentFragment();

  const lineas =
    texto.trim().split(/\r?\n/);

  let estrofa = [];

  function agregarEstrofa() {
    if (estrofa.length === 0) {
      return;
    }

    const bloque =
      document.createElement("p");

    bloque.className =
      "song__stanza";

    estrofa.forEach((linea) => {
      bloque.append(
        crearLineaLetra(linea)
      );
    });

    fragmento.append(bloque);

    estrofa = [];
  }

  lineas.forEach((lineaOriginal) => {
    const linea =
      lineaOriginal.trim();

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

    if (
      /(\(\s*bis\s*\)|\bbis\b)/i.test(linea) ||
      estrofa.length === 4
    ) {
      agregarEstrofa();
    }
  });

  agregarEstrofa();

  return fragmento;
}

function crearCancion(cancion) {
  const articulo =
    document.createElement("article");

  const idContenido =
    `letra-${cancion.numero.replace(/\W/g, "-")}`;

  const reproductorYoutube =
    crearReproductorYoutube(cancion);

  articulo.className = "song";
  articulo.dataset.numero =
    cancion.numero;

  const boton =
    document.createElement("button");

  boton.className = "song__button";
  boton.type = "button";

  boton.setAttribute(
    "aria-expanded",
    "false"
  );

  boton.setAttribute(
    "aria-controls",
    idContenido
  );

  const numero =
    document.createElement("span");

  numero.className =
    "song__number";

  numero.textContent =
    cancion.numero;

  const titulo =
    document.createElement("span");

  titulo.className =
    "song__title";

  titulo.textContent =
    cancion.titulo;

  const icono =
    document.createElement("span");

  icono.className =
    "song__chevron";

  icono.setAttribute(
    "aria-hidden",
    "true"
  );

  boton.append(
    numero,
    titulo,
    icono
  );

  const contenido =
    document.createElement("div");

  contenido.className =
    "song__content";

  contenido.id =
    idContenido;

  const contenidoInterior =
    document.createElement("div");

  contenidoInterior.className =
    "song__content-inner";

  const letra =
    document.createElement("div");

  letra.className =
    "song__lyrics";

  letra.append(
    crearEstrofas(cancion.letra)
  );

  if (reproductorYoutube) {
    letra.append(
      reproductorYoutube
    );
  }

  contenidoInterior.append(letra);
  contenido.append(contenidoInterior);

  articulo.append(
    boton,
    contenido
  );

  boton.addEventListener(
    "click",
    () =>
      alternarCancion(
        articulo,
        boton,
        cancion.numero
      )
  );

  return articulo;
}

function alternarCancion(
  articulo,
  boton,
  numeroCancion
) {
  const estabaAbierta =
    cancionAbierta === numeroCancion;

  document
    .querySelectorAll(".song.is-open")
    .forEach((cancion) => {
      detenerVideoDeCancion(cancion);

      cancion.classList.remove(
        "is-open"
      );

      cancion
        .querySelector(".song__button")
        .setAttribute(
          "aria-expanded",
          "false"
        );
    });

  if (estabaAbierta) {
    cancionAbierta = null;
    return;
  }

  articulo.classList.add(
    "is-open"
  );

  boton.setAttribute(
    "aria-expanded",
    "true"
  );

  cancionAbierta =
    numeroCancion;
}

function cerrarTodasLasCanciones() {
  document
    .querySelectorAll(".song.is-open")
    .forEach((cancion) => {
      detenerVideoDeCancion(cancion);

      cancion.classList.remove(
        "is-open"
      );

      cancion
        .querySelector(".song__button")
        .setAttribute(
          "aria-expanded",
          "false"
        );
    });

  cancionAbierta = null;
}

function filtrarCanciones() {
  const consulta =
    normalizarTexto(buscador.value);

  const resultados =
    canciones.filter((cancion) => {
      const contenido =
        normalizarTexto(
          `${cancion.numero} ${cancion.titulo} ${cancion.letra}`
        );

      return contenido.includes(
        consulta
      );
    });

  renderizarCanciones(
    resultados
  );

  limpiarBusqueda.hidden =
    buscador.value.length === 0;
}

function renderizarCanciones(resultados) {
  listaCanciones.replaceChildren(
    ...resultados.map(crearCancion)
  );

  contador.textContent =
    `Mostrando ${resultados.length} de ${canciones.length} canciones`;

  sinResultados.hidden =
    resultados.length !== 0;

  listaCanciones.hidden =
    resultados.length === 0;

  if (
    !resultados.some(
      (cancion) =>
        cancion.numero === cancionAbierta
    )
  ) {
    cancionAbierta = null;
  }
}

buscador.addEventListener(
  "input",
  filtrarCanciones
);

limpiarBusqueda.addEventListener(
  "click",
  () => {
    buscador.value = "";

    filtrarCanciones();

    buscador.focus();
  }
);

cerrarTodo.addEventListener(
  "click",
  cerrarTodasLasCanciones
);

async function cargarCanciones() {
  try {
    canciones =
      await window.CancioneroDB.listSongs();

    estadoCarga.hidden = true;

    renderizarCanciones(
      canciones
    );
  } catch (error) {
    console.error(error);

    estadoCarga.textContent =
      "No se pudieron cargar las canciones.";
  }
}

function escaparHtml(texto) {
  return String(texto).replace(
    /[&<>"']/g,
    (caracter) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[caracter]
  );
}

function generarLibro() {
  if (!canciones.length) {
    return;
  }

  /*
    =====================================================
    FORMATO DEL CUADERNILLO
    =====================================================

    Papel físico:
    A4 vertical.

    Cada cara:
    4 páginas pequeñas.

    DISTRIBUCIÓN:

    ┌─────────────┬─────────────┐
    │ página      │ página      │
    │ superior   │ superior    │
    ├─────────────┼─────────────┤
    │ página      │ página      │
    │ inferior   │ inferior    │
    └─────────────┴─────────────┘

    Se imprime por AMBAS CARAS.

    Después:

    1. Se corta solamente horizontalmente.
    2. Cada mitad queda como A5 horizontal.
    3. Se dobla por la mitad vertical.
    4. Las hojas se meten una dentro de otra.
    5. Se engrapan por el pliegue central.

    PDF:

    páginas impares =
    FRENTE de cada A4.

    páginas pares =
    REVERSO de cada A4.
  */

  const urlCautivo =
    new URL(
      "assets/cautivo.png",
      window.location.href
    ).href;

  const urlSantuario =
    new URL(
      "assets/santuario.png",
      window.location.href
    ).href;

  function clasePorLongitud(texto) {
    const longitud =
      String(texto || "").length;

    if (longitud > 1250) {
      return "song--xxl";
    }

    if (longitud > 1000) {
      return "song--xl";
    }

    if (longitud > 780) {
      return "song--long";
    }

    if (longitud > 560) {
      return "song--medium";
    }

    return "";
  }

  function paginaCancion(cancion) {
    return `
      <article
        class="
          book-page
          song-page
          ${clasePorLongitud(cancion.letra)}
        "
      >

        <header class="song-heading">

          <span class="song-number">
            ${escaparHtml(cancion.numero)}
          </span>

          <h2>
            ${escaparHtml(cancion.titulo)}
          </h2>

        </header>

        ${
          cancion.categoria
            ? `
              <p class="song-category">
                ${escaparHtml(cancion.categoria)}
              </p>
            `
            : ""
        }

        <div class="song-text">
          ${escaparHtml(cancion.letra).replace(
            /\n/g,
            "<br>"
          )}
        </div>

      </article>
    `;
  }

  function paginaBlanca() {
    return `
      <section
        class="book-page blank-page"
      ></section>
    `;
  }

  /*
    =========================
    PÁGINAS DEL LIBRO
    =========================
  */

  const paginas = [

    /*
      PORTADA
    */

    `
      <section
        class="book-page book-cover"
      >

        <img
          class="cover-sanctuary"
          src="${urlSantuario}"
          alt=""
        >

        <div
          class="cover-overlay"
        ></div>

        <div class="cover-content">

          <div
            class="cover-ornament"
          >
            ✥
          </div>

          <img
            class="cover-cautivo"
            src="${urlCautivo}"
            alt="Señor Cautivo de Ayabaca"
          >

          <h1>
            Cancionero
          </h1>

          <h2>
            Señor Cautivo
          </h2>

          <p>
            Ayabaca · Piura
          </p>

          <div
            class="cover-line"
          ></div>

          <small>
            Fe · tradición · devoción
          </small>

        </div>

      </section>
    `,

    /*
      CANCIONES
    */

    ...canciones.map(
      paginaCancion
    )

  ];

  /*
    =========================================
    COMPLETAR PÁGINAS PARA IMPRESIÓN
    =========================================

    Cada A4 completo contiene:

    4 páginas delante
    +
    4 páginas detrás

    = 8 páginas finales.

    Por eso completamos hasta
    múltiplo de 8.
  */

  while (
    paginas.length % 8 !== 0
  ) {
    paginas.push(
      paginaBlanca()
    );
  }

  const totalPaginas =
    paginas.length;

  /*
    Una hoja A5 doblada
    representa 4 páginas.
  */

  const cantidadHojasA5 =
    totalPaginas / 4;

  /*
    Una A4 contiene
    dos hojas A5.
  */

  const cantidadHojasA4 =
    cantidadHojasA5 / 2;

  /*
    =========================================
    IMPOSICIÓN DEL CUADERNILLO
    =========================================

    Ejemplo:

    8 páginas

    HOJA EXTERIOR

    frente:
    8 | 1

    reverso:
    2 | 7

    HOJA INTERIOR

    frente:
    6 | 3

    reverso:
    4 | 5
  */

  const hojasA5 = [];

  for (
    let i = 0;
    i < cantidadHojasA5;
    i += 1
  ) {
    const izquierdaFrente =
      totalPaginas - (i * 2);

    const derechaFrente =
      1 + (i * 2);

    const izquierdaReverso =
      2 + (i * 2);

    const derechaReverso =
      totalPaginas - 1 - (i * 2);

    hojasA5.push({
      frente: [
        izquierdaFrente,
        derechaFrente
      ],

      reverso: [
        izquierdaReverso,
        derechaReverso
      ]
    });
  }

  function obtenerPagina(numero) {
    if (
      !numero ||
      numero < 1 ||
      numero > paginas.length
    ) {
      return paginaBlanca();
    }

    return paginas[
      numero - 1
    ];
  }

  function numeroVisible(numero) {
    /*
      La portada no muestra número.
    */

    if (
      numero <= 1 ||
      numero > paginas.length
    ) {
      return "";
    }

    return `
      <span
        class="printed-page-number"
      >
        ${numero}
      </span>
    `;
  }

  function crearMitadA5(
    par,
    clase
  ) {
    const [
      izquierda,
      derecha
    ] = par;

    return `
      <section
        class="
          half-sheet
          ${clase}
        "
      >

        <div
          class="
            imposed-page
            imposed-page--left
          "
        >

          ${obtenerPagina(izquierda)}

          ${numeroVisible(izquierda)}

        </div>

        <div
          class="fold-guide"
          aria-hidden="true"
        ></div>

        <div
          class="
            imposed-page
            imposed-page--right
          "
        >

          ${obtenerPagina(derecha)}

          ${numeroVisible(derecha)}

        </div>

      </section>
    `;
  }

  let hojasImpuestas = "";

  /*
    =========================================
    CREAR CADA HOJA A4
    =========================================
  */

  for (
    let i = 0;
    i < cantidadHojasA4;
    i += 1
  ) {
    const hojaSuperior =
      hojasA5[i * 2];

    const hojaInferior =
      hojasA5[
        (i * 2) + 1
      ];

    /*
      Cada A4 genera
      DOS páginas en el PDF.

      Página impar:
      frente.

      Página par:
      reverso.
    */

    hojasImpuestas += `

      <!-- FRENTE A4 -->

      <section
        class="
          a4-sheet
          a4-sheet--front
        "
      >

        ${crearMitadA5(
          hojaSuperior.frente,
          "half-sheet--top"
        )}

        ${crearMitadA5(
          hojaInferior.frente,
          "half-sheet--bottom"
        )}

        <div
          class="cut-guide"
        >
          <span>
            CORTAR
          </span>
        </div>

      </section>


      <!-- REVERSO A4 -->

      <section
        class="
          a4-sheet
          a4-sheet--back
        "
      >

        ${crearMitadA5(
          hojaSuperior.reverso,
          "half-sheet--top"
        )}

        ${crearMitadA5(
          hojaInferior.reverso,
          "half-sheet--bottom"
        )}

        <div
          class="cut-guide"
        >
          <span>
            CORTAR
          </span>
        </div>

      </section>

    `;
  }

  /*
    =========================================
    ABRIR VENTANA DE IMPRESIÓN
    =========================================
  */

  const ventana =
    window.open(
      "",
      "_blank"
    );

  if (!ventana) {
    alert(
      "Permite las ventanas emergentes para generar el libro."
    );

    return;
  }

  ventana.document.write(`
<!doctype html>

<html lang="es">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="
      width=device-width,
      initial-scale=1
    "
  >

  <title>
    Cancionero Señor Cautivo — Cuadernillo
  </title>

  <style>

    /*
      ==================================
      CONFIGURACIÓN DE PAPEL
      ==================================
    */

    @page {

      size:
        A4 portrait;

      margin:
        0;

    }

    * {

      box-sizing:
        border-box;

    }

    html,
    body {

      margin:
        0;

      padding:
        0;

      color:
        #2F2A26;

      background:
        #ECEAE6;

      font-family:
        Georgia,
        "Times New Roman",
        serif;

    }

    /*
      ==================================
      INSTRUCCIONES
      NO SE IMPRIMEN
      ==================================
    */

    .print-help {

      width:
        min(
          92%,
          940px
        );

      margin:
        24px auto;

      padding:
        24px 28px;

      color:
        #2F2A26;

      background:
        #FFFDF8;

      border:
        1px solid
        #D5C18E;

      border-radius:
        18px;

      box-shadow:
        0 12px 30px
        rgba(
          53,
          36,
          72,
          .10
        );

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      line-height:
        1.55;

    }

    .print-help h1 {

      margin:
        0 0 12px;

      color:
        #352448;

      font-family:
        Georgia,
        "Times New Roman",
        serif;

      font-size:
        28px;

    }

    .print-help h2 {

      margin:
        22px 0 8px;

      color:
        #4A3A68;

      font-size:
        18px;

    }

    .print-help p {

      margin:
        8px 0;

    }

    .print-help strong {

      color:
        #352448;

    }

    .print-help .important {

      margin-top:
        16px;

      padding:
        13px 15px;

      background:
        #F5F2EA;

      border-left:
        4px solid
        #A88A44;

      border-radius:
        8px;

    }

    .print-help button {

      margin-top:
        18px;

      padding:
        12px 20px;

      color:
        #FFFFFF;

      background:
        #4A3A68;

      border:
        0;

      border-radius:
        10px;

      cursor:
        pointer;

      font-weight:
        700;

      font-size:
        15px;

    }

    /*
      ==================================
      HOJA FÍSICA A4
      ==================================
    */

    .a4-sheet {

      position:
        relative;

      display:
        grid;

      grid-template-rows:
        148.5mm
        148.5mm;

      width:
        210mm;

      height:
        297mm;

      margin:
        0 auto 10mm;

      overflow:
        hidden;

      background:
        #FFFFFF;

      break-after:
        page;

      page-break-after:
        always;

    }

    .a4-sheet:last-child {

      break-after:
        auto;

      page-break-after:
        auto;

    }

    /*
      ==================================
      LÍNEA HORIZONTAL DE CORTE
      ==================================
    */

    .cut-guide {

      position:
        absolute;

      z-index:
        30;

      top:
        148.5mm;

      left:
        0;

      width:
        210mm;

      height:
        0;

      border-top:
        .35mm dashed
        rgba(
          0,
          0,
          0,
          .62
        );

      pointer-events:
        none;

    }

    .cut-guide span {

      position:
        absolute;

      top:
        -3.2mm;

      left:
        3mm;

      padding:
        0 .8mm;

      color:
        #555;

      background:
        #FFF;

      font:
        5.5pt
        Arial,
        Helvetica,
        sans-serif;

      letter-spacing:
        .08em;

    }

    /*
      ==================================
      CADA MITAD A5
      ==================================
    */

    .half-sheet {

      position:
        relative;

      display:
        grid;

      grid-template-columns:
        105mm
        105mm;

      width:
        210mm;

      height:
        148.5mm;

      overflow:
        hidden;

      background:
        #FFFFFF;

    }

    /*
      Línea vertical:
      SOLO DOBLEZ.

      NO CORTAR.
    */

    .fold-guide {

      position:
        absolute;

      z-index:
        20;

      top:
        0;

      bottom:
        0;

      left:
        105mm;

      width:
        0;

      border-left:
        .18mm dotted
        rgba(
          168,
          138,
          68,
          .42
        );

      pointer-events:
        none;

    }

    /*
      ==================================
      PÁGINA FINAL A6
      ==================================
    */

    .imposed-page {

      position:
        relative;

      width:
        105mm;

      height:
        148.5mm;

      overflow:
        hidden;

      background:
        #FFFFFF;

    }

    .imposed-page--left {

      grid-column:
        1;

    }

    .imposed-page--right {

      grid-column:
        2;

    }

    .book-page {

      position:
        relative;

      width:
        100%;

      height:
        100%;

      overflow:
        hidden;

      padding:
        7mm
        6.5mm
        8mm;

      background:
        #FFFFFF;

    }

    /*
      ==================================
      NÚMERO DE PÁGINA
      ==================================
    */

    .printed-page-number {

      position:
        absolute;

      z-index:
        10;

      right:
        0;

      bottom:
        2.6mm;

      left:
        0;

      color:
        #80766D;

      text-align:
        center;

      font:
        5.4pt
        Arial,
        Helvetica,
        sans-serif;

    }

    /*
      ==================================
      PORTADA
      ==================================
    */

    .book-cover {

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      padding:
        0;

      isolation:
        isolate;

      color:
        #FFFFFF;

      background:
        linear-gradient(
          180deg,
          rgba(
            53,
            36,
            72,
            .92
          ),
          rgba(
            53,
            36,
            72,
            .84
          )
        );

    }

    .cover-sanctuary {

      position:
        absolute;

      z-index:
        -3;

      inset:
        0;

      width:
        100%;

      height:
        100%;

      object-fit:
        cover;

      opacity:
        .28;

      filter:
        grayscale(.12)
        contrast(1.05);

    }

    .cover-overlay {

      position:
        absolute;

      z-index:
        -2;

      inset:
        0;

      background:
        linear-gradient(
          180deg,
          rgba(
            53,
            36,
            72,
            .50
          ),
          rgba(
            30,
            19,
            42,
            .86
          )
        );

    }

    .cover-content {

      width:
        86%;

      text-align:
        center;

    }

    .cover-ornament {

      margin-bottom:
        2.5mm;

      color:
        #E2CA89;

      font-size:
        15pt;

    }

    .cover-cautivo {

      display:
        block;

      max-width:
        45mm;

      max-height:
        55mm;

      margin:
        0 auto 3.5mm;

      object-fit:
        contain;

      filter:
        drop-shadow(
          0
          2mm
          2.5mm
          rgba(
            0,
            0,
            0,
            .25
          )
        );

    }

    .book-cover h1 {

      margin:
        0;

      color:
        #FFFFFF;

      font-size:
        18pt;

      font-weight:
        400;

      letter-spacing:
        .055em;

      line-height:
        1;

      text-transform:
        uppercase;

    }

    .book-cover h2 {

      margin:
        1.6mm 0 0;

      color:
        #F1E5C4;

      font-size:
        11.5pt;

      font-weight:
        400;

      letter-spacing:
        .025em;

      text-transform:
        uppercase;

    }

    .book-cover p {

      margin:
        3.6mm 0 0;

      color:
        #E2CA89;

      font:
        6.3pt
        Arial,
        Helvetica,
        sans-serif;

      font-weight:
        700;

      letter-spacing:
        .20em;

      text-transform:
        uppercase;

    }

    .cover-line {

      width:
        24mm;

      height:
        .35mm;

      margin:
        4mm auto 3mm;

      background:
        #D5C18E;

    }

    .book-cover small {

      color:
        rgba(
          255,
          255,
          255,
          .88
        );

      font:
        5.8pt
        Arial,
        Helvetica,
        sans-serif;

      letter-spacing:
        .08em;

      text-transform:
        uppercase;

    }

    /*
      ==================================
      CANCIONES
      ==================================
    */

    .song-page {

      text-align:
        center;

    }

    .song-heading {

      display:
        flex;

      align-items:
        baseline;

      justify-content:
        center;

      gap:
        2mm;

      margin:
        0 0 2.7mm;

      padding-bottom:
        2mm;

      border-bottom:
        .35mm solid
        #D5C18E;

    }

    .song-number {

      flex:
        none;

      color:
        #A88A44;

      font-size:
        9pt;

      font-weight:
        700;

    }

    .song-heading h2 {

      margin:
        0;

      color:
        #352448;

      font-size:
        10.2pt;

      line-height:
        1.12;

      text-transform:
        uppercase;

    }

    .song-category {

      margin:
        -1mm 0 2mm;

      color:
        #786F66;

      font:
        5.3pt
        Arial,
        Helvetica,
        sans-serif;

      letter-spacing:
        .10em;

      text-transform:
        uppercase;

    }

    .song-text {

      color:
        #3D3833;

      font-size:
        7.05pt;

      line-height:
        1.30;

    }

    .song--medium .song-text {

      font-size:
        6.55pt;

      line-height:
        1.23;

    }

    .song--long .song-text {

      font-size:
        5.95pt;

      line-height:
        1.17;

    }

    .song--xl .song-text {

      font-size:
        5.35pt;

      line-height:
        1.10;

    }

    .song--xxl .song-text {

      font-size:
        4.85pt;

      line-height:
        1.04;

    }

    .song--xl .song-heading,
    .song--xxl .song-heading {

      margin-bottom:
        1.7mm;

      padding-bottom:
        1.4mm;

    }

    .song--xl .song-heading h2,
    .song--xxl .song-heading h2 {

      font-size:
        8.8pt;

    }

    .blank-page {

      background:
        #FFFFFF;

    }

    /*
      ==================================
      IMPRESIÓN
      ==================================
    */

    @media print {

      html,
      body {

        width:
          210mm;

        margin:
          0;

        padding:
          0;

        background:
          #FFFFFF;

      }

      .no-print {

        display:
          none !important;

      }

      .a4-sheet {

        margin:
          0;

        box-shadow:
          none;

      }

    }

    @media screen {

      .a4-sheet {

        box-shadow:
          0 8px 24px
          rgba(
            0,
            0,
            0,
            .15
          );

      }

    }

  </style>

</head>

<body>

  <!--
    ==================================
    INSTRUCCIONES
    ==================================
  -->

  <section
    class="
      print-help
      no-print
    "
  >

    <h1>
      Cuadernillo listo para impresión
    </h1>

    <p>

      El cancionero tiene

      <strong>
        ${totalPaginas}
        páginas finales A6
      </strong>

      distribuidas en

      <strong>
        ${cantidadHojasA4}
        hojas físicas A4
      </strong>.

    </p>

    <p>

      Cada A4 contiene

      <strong>
        4 páginas por delante
        y 4 por detrás
      </strong>.

      Después de imprimir
      solamente debes hacer

      <strong>
        UN corte horizontal
        por la mitad
      </strong>

      de cada A4.

    </p>

    <p>

      La línea horizontal
      punteada indica el corte.

      La línea vertical central
      solamente indica
      dónde doblar.

    </p>


    <h2>
      Impresora con doble cara automática
    </h2>

    <p>

      Imprime

      <strong>
        TODAS las páginas
      </strong>.

    </p>

    <p>

      Activa

      <strong>
        impresión a doble cara
      </strong>.

    </p>

    <p>

      Selecciona:

      <strong>
        Voltear por borde largo
      </strong>.

    </p>

    <p>

      Papel:

      <strong>
        A4
      </strong>.

      Escala:

      <strong>
        100 %
      </strong>.

    </p>


    <h2>
      Impresora sin doble cara automática
    </h2>

    <p>

      Este archivo está preparado
      especialmente para hacerlo
      manualmente.

    </p>

    <p>

      Las

      <strong>
        páginas IMPARES
        del PDF
      </strong>

      son todos los

      <strong>
        FRENTES
      </strong>.

    </p>

    <p>

      Las

      <strong>
        páginas PARES
        del PDF
      </strong>

      son todos los

      <strong>
        REVERSOS
      </strong>.

    </p>

    <p>

      Primera pasada:

      <strong>
        imprime
        1, 3, 5, 7, 9…
      </strong>

    </p>

    <p>

      Después vuelve
      a colocar esas hojas
      en la impresora.

    </p>

    <p>

      Segunda pasada:

      <strong>
        imprime
        2, 4, 6, 8, 10…
      </strong>

    </p>


    <div class="important">

      <strong>
        IMPORTANTE:
      </strong>

      antes de imprimir
      todo el cancionero,

      haz una prueba
      solamente con
      la primera hoja física.

      Cada impresora
      introduce el papel
      de manera diferente.

      Si el reverso
      aparece de cabeza,

      cambia la orientación
      con la que colocas
      nuevamente las hojas.

    </div>


    <h2>
      Después de imprimir
    </h2>

    <p>

      1.
      Mantén las hojas A4
      en orden.

      <br>

      2.
      Corta cada A4
      únicamente por
      la línea horizontal
      central.

      <br>

      3.
      Obtendrás dos mitades
      A5 horizontales
      por cada A4.

      <br>

      4.
      Ordena las hojas
      desde la exterior
      hacia la interior.

      <br>

      5.
      Dobla cada mitad
      por la línea vertical.

      <br>

      6.
      Mete unas hojas
      dentro de las otras.

      <br>

      7.
      Engrapa exactamente
      sobre el pliegue
      vertical central.

    </p>


    <p>

      En Chrome
      desactiva:

      <strong>
        Encabezados y pies
        de página
      </strong>.

    </p>


    <button
      type="button"
      onclick="window.print()"
    >

      Imprimir / Guardar como PDF

    </button>

  </section>


  <!--
    ==================================
    HOJAS DEL CUADERNILLO
    ==================================
  -->

  ${hojasImpuestas}

</body>

</html>
  `);

  ventana.document.close();
}

/*
  =========================================
  BOTÓN PDF
  =========================================
*/

generarPdf.addEventListener(
  "click",
  generarLibro
);

/*
  =========================================
  CARGAR CANCIONES
  =========================================
*/

cargarCanciones();
