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

  return inicio > 0
    ? `${enlace}${separador}t=${inicio}s`
    : enlace;
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

    const inicio = Math.max(
      0,
      Number(cancion.inicio) || 0
    );

    const parametros = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1"
    });

    if (inicio > 0) {
      parametros.set(
        "start",
        String(inicio)
      );
    }

    if (
      window.location.protocol === "http:" ||
      window.location.protocol === "https:"
    ) {
      parametros.set(
        "origin",
        window.location.origin
      );
    }

    return {
      externo: enlace,
      embed:
        `https://www.youtube.com/embed/` +
        `${encodeURIComponent(videoId)}?${parametros}`
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

  const seccion =
    document.createElement("section");

  seccion.className =
    "song__media";

  const boton =
    document.createElement("button");

  boton.className =
    "song__video-button";

  boton.type =
    "button";

  boton.textContent =
    "Ver video";

  const contenedor =
    document.createElement("div");

  contenedor.className =
    "song__player";

  contenedor.hidden =
    true;

  const ayuda =
    document.createElement("p");

  ayuda.className =
    "song__video-help";

  ayuda.append(
    "Si el video no se reproduce aquí, "
  );

  const enlaceExterno =
    document.createElement("a");

  enlaceExterno.href =
    video.externo;

  enlaceExterno.target =
    "_blank";

  enlaceExterno.rel =
    "noopener noreferrer";

  enlaceExterno.textContent =
    "abrir en YouTube";

  ayuda.append(
    enlaceExterno,
    "."
  );

  boton.addEventListener(
    "click",
    () => {
      const estaVisible =
        !contenedor.hidden;

      if (estaVisible) {
        contenedor.replaceChildren();

        contenedor.classList.remove(
          "song__player--notice"
        );

        contenedor.hidden =
          true;

        boton.textContent =
          "Ver video";

        boton.setAttribute(
          "aria-expanded",
          "false"
        );

        return;
      }

      if (
        window.location.protocol === "file:"
      ) {
        const aviso =
          document.createElement("div");

        aviso.className =
          "song__local-video-notice";

        const titulo =
          document.createElement("strong");

        titulo.textContent =
          "Vista local";

        const texto =
          document.createElement("p");

        texto.textContent =
          "YouTube no permite reproducir videos incrustados al abrir index.html directamente. En GitHub Pages funcionarán dentro de esta sección.";

        const enlace =
          document.createElement("a");

        enlace.href =
          video.externo;

        enlace.target =
          "_blank";

        enlace.rel =
          "noopener noreferrer";

        enlace.textContent =
          "Ver ahora en YouTube";

        aviso.append(
          titulo,
          texto,
          enlace
        );

        contenedor.append(
          aviso
        );

        contenedor.classList.add(
          "song__player--notice"
        );

        contenedor.hidden =
          false;

        boton.textContent =
          "Ocultar aviso";

        boton.setAttribute(
          "aria-expanded",
          "true"
        );

        return;
      }

      const iframe =
        document.createElement("iframe");

      iframe.src =
        video.embed;

      iframe.title =
        `Video de ${cancion.titulo}`;

      iframe.loading =
        "lazy";

      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

      iframe.allowFullscreen =
        true;

      iframe.referrerPolicy =
        "origin-when-cross-origin";

      contenedor.classList.remove(
        "song__player--notice"
      );

      contenedor.append(
        iframe
      );

      contenedor.hidden =
        false;

      boton.textContent =
        "Ocultar video";

      boton.setAttribute(
        "aria-expanded",
        "true"
      );
    }
  );

  boton.setAttribute(
    "aria-expanded",
    "false"
  );

  seccion.append(
    boton,
    contenedor,
    ayuda
  );

  return seccion;
}

function detenerVideoDeCancion(cancion) {
  const reproductor =
    cancion.querySelector(
      ".song__player"
    );

  const boton =
    cancion.querySelector(
      ".song__video-button"
    );

  if (
    !reproductor ||
    !boton
  ) {
    return;
  }

  reproductor.replaceChildren();

  reproductor.classList.remove(
    "song__player--notice"
  );

  reproductor.hidden =
    true;

  boton.textContent =
    "Ver video";

  boton.setAttribute(
    "aria-expanded",
    "false"
  );
}

function esIndicacionMusical(linea) {
  return /^\s*\(?\s*(coro|instrumental)\s*(?:…|\.{3})?\s*\)?\s*$/i.test(
    linea
  );
}

function crearLineaLetra(texto) {
  const linea =
    document.createElement("span");

  const patronDestacado =
    /(\(\s*bis\s*\)|\bbis\b)/gi;

  let posicion = 0;

  if (
    esIndicacionMusical(texto)
  ) {
    const destacado =
      document.createElement("strong");

    destacado.className =
      "song__direction";

    destacado.textContent =
      texto;

    linea.append(
      destacado
    );

    return linea;
  }

  for (
    const coincidencia
    of texto.matchAll(
      patronDestacado
    )
  ) {
    linea.append(
      document.createTextNode(
        texto.slice(
          posicion,
          coincidencia.index
        )
      )
    );

    const destacado =
      document.createElement("strong");

    destacado.className =
      "song__repeat";

    destacado.textContent =
      coincidencia[0];

    linea.append(
      destacado
    );

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
    texto
      .trim()
      .split(/\r?\n/);

  let estrofa = [];

  function agregarEstrofa() {
    if (
      estrofa.length === 0
    ) {
      return;
    }

    const bloque =
      document.createElement("p");

    bloque.className =
      "song__stanza";

    estrofa.forEach(
      (linea) =>
        bloque.append(
          crearLineaLetra(linea)
        )
    );

    fragmento.append(
      bloque
    );

    estrofa = [];
  }

  lineas.forEach(
    (lineaOriginal) => {
      const linea =
        lineaOriginal.trim();

      if (!linea) {
        agregarEstrofa();
        return;
      }

      if (
        esIndicacionMusical(linea)
      ) {
        agregarEstrofa();

        estrofa.push(
          linea
        );

        agregarEstrofa();

        return;
      }

      estrofa.push(
        linea
      );

      if (
        /(\(\s*bis\s*\)|\bbis\b)/i.test(linea) ||
        estrofa.length === 4
      ) {
        agregarEstrofa();
      }
    }
  );

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

  articulo.className =
    "song";

  articulo.dataset.numero =
    cancion.numero;

  const boton =
    document.createElement("button");

  boton.className =
    "song__button";

  boton.type =
    "button";

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
    crearEstrofas(
      cancion.letra
    )
  );

  if (
    reproductorYoutube
  ) {
    letra.append(
      reproductorYoutube
    );
  }

  contenidoInterior.append(
    letra
  );

  contenido.append(
    contenidoInterior
  );

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
    cancionAbierta ===
    numeroCancion;

  document
    .querySelectorAll(
      ".song.is-open"
    )
    .forEach(
      (cancion) => {
        detenerVideoDeCancion(
          cancion
        );

        cancion.classList.remove(
          "is-open"
        );

        cancion
          .querySelector(
            ".song__button"
          )
          .setAttribute(
            "aria-expanded",
            "false"
          );
      }
    );

  if (estabaAbierta) {
    cancionAbierta =
      null;

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
    .querySelectorAll(
      ".song.is-open"
    )
    .forEach(
      (cancion) => {
        detenerVideoDeCancion(
          cancion
        );

        cancion.classList.remove(
          "is-open"
        );

        cancion
          .querySelector(
            ".song__button"
          )
          .setAttribute(
            "aria-expanded",
            "false"
          );
      }
    );

  cancionAbierta =
    null;
}

function filtrarCanciones() {
  const consulta =
    normalizarTexto(
      buscador.value
    );

  const resultados =
    canciones.filter(
      (cancion) => {
        const contenido =
          normalizarTexto(
            `${cancion.numero} ${cancion.titulo} ${cancion.letra}`
          );

        return contenido.includes(
          consulta
        );
      }
    );

  renderizarCanciones(
    resultados
  );

  limpiarBusqueda.hidden =
    buscador.value.length === 0;
}

function renderizarCanciones(resultados) {
  listaCanciones.replaceChildren(
    ...resultados.map(
      crearCancion
    )
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
        cancion.numero ===
        cancionAbierta
    )
  ) {
    cancionAbierta =
      null;
  }
}

buscador.addEventListener(
  "input",
  filtrarCanciones
);

limpiarBusqueda.addEventListener(
  "click",
  () => {
    buscador.value =
      "";

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
      await window
        .CancioneroDB
        .listSongs();

    estadoCarga.hidden =
      true;

    renderizarCanciones(
      canciones
    );
  } catch (error) {
    console.error(
      error
    );

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

/*
  ======================================================
  GENERADOR DE CUADERNILLO
  ======================================================
*/

function generarLibro() {
  if (!canciones.length) {
    return;
  }

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

  /*
    Página en blanco.
  */

  const paginaBlanca =
    () => `
      <section
        class="book-page blank-page"
      ></section>
    `;

  /*
    Página de canción.

    IMPORTANTE:

    Ya NO asignamos
    medium, long, etc.

    El tamaño será calculado
    automáticamente después.
  */

  const paginaCancion =
    (cancion) => `
      <article
        class="book-page song-page"
      >

        <header
          class="song-heading"
        >

          <span
            class="song-number"
          >
            ${escaparHtml(cancion.numero)}
          </span>

          <h2>
            ${escaparHtml(cancion.titulo)}
          </h2>

        </header>

        ${
          cancion.categoria
            ? `
              <p
                class="song-category"
              >
                ${escaparHtml(cancion.categoria)}
              </p>
            `
            : ""
        }

        <div
          class="song-text"
        >
          ${escaparHtml(
            cancion.letra
          ).replace(
            /\n/g,
            "<br>"
          )}
        </div>

      </article>
    `;

  /*
    ======================================================
    PÁGINAS DEL LIBRO
    ======================================================
  */

  const paginas = [

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

        <div
          class="cover-content"
        >

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

    ...canciones.map(
      paginaCancion
    )

  ];

  /*
    Cada A4 representa
    8 páginas finales.

    Completamos el libro
    hasta múltiplo de 8.
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

  const cantidadHojasA5 =
    totalPaginas / 4;

  const cantidadHojasA4 =
    cantidadHojasA5 / 2;

  /*
    ======================================================
    IMPOSICIÓN
    ======================================================
  */

  const hojasA5 = [];

  for (
    let i = 0;
    i < cantidadHojasA5;
    i += 1
  ) {
    hojasA5.push({
      frente: [
        totalPaginas -
          i * 2,

        1 +
          i * 2
      ],

      reverso: [
        2 +
          i * 2,

        totalPaginas -
          1 -
          i * 2
      ]
    });
  }

  function obtenerPagina(numero) {
    return (
      paginas[numero - 1] ||
      paginaBlanca()
    );
  }

  function numeroVisible(numero) {
    /*
      Página 1 =
      portada.

      No mostramos
      numeración.
    */

    if (
      numero <= 1
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
        class="half-sheet ${clase}"
      >

        <div
          class="
            imposed-page
            imposed-page--left
          "
        >

          ${obtenerPagina(
            izquierda
          )}

          ${numeroVisible(
            izquierda
          )}

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

          ${obtenerPagina(
            derecha
          )}

          ${numeroVisible(
            derecha
          )}

        </div>

      </section>
    `;
  }

  /*
    ======================================================
    CREAR A4
    ======================================================
  */

  let hojasImpuestas =
    "";

  for (
    let i = 0;
    i < cantidadHojasA4;
    i += 1
  ) {
    const superior =
      hojasA5[
        i * 2
      ];

    const inferior =
      hojasA5[
        i * 2 + 1
      ];

    /*
      Página impar del PDF =
      frente.

      Página par =
      reverso.
    */

    hojasImpuestas += `

      <section
        class="
          a4-sheet
          a4-sheet--front
        "
      >

        ${crearMitadA5(
          superior.frente,
          "half-sheet--top"
        )}

        ${crearMitadA5(
          inferior.frente,
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


      <section
        class="
          a4-sheet
          a4-sheet--back
        "
      >

        ${crearMitadA5(
          superior.reverso,
          "half-sheet--top"
        )}

        ${crearMitadA5(
          inferior.reverso,
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
    ======================================================
    ABRIR VENTANA
    ======================================================
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
    ======================================================
    PAPEL
    ======================================================
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
    ======================================================
    INSTRUCCIONES
    ======================================================
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

    background:
      #FFFDF8;

    border:
      1px solid #D5C18E;

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
      4px solid #A88A44;

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
    ======================================================
    HOJA A4
    ======================================================
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
    CORTE HORIZONTAL.
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
      #FFFFFF;

    font:
      5.5pt
      Arial,
      Helvetica,
      sans-serif;

    letter-spacing:
      .08em;
  }

  /*
    ======================================================
    MITAD A5 HORIZONTAL
    ======================================================
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
    Línea vertical =
    doblado.

    NO cortar.
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
    ======================================================
    PÁGINA FINAL
    ======================================================
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

  .book-page {
    position:
      relative;

    width:
      100%;

    height:
      100%;

    overflow:
      hidden;

    /*
      Reduje ligeramente
      los márgenes para
      aprovechar más área.
    */

    padding:
      6.5mm
      6mm
      8mm;

    background:
      #FFFFFF;
  }

  .printed-page-number {
    position:
      absolute;

    z-index:
      10;

    right:
      0;

    bottom:
      2.5mm;

    left:
      0;

    color:
      #80766D;

    text-align:
      center;

    font:
      5.5pt
      Arial,
      Helvetica,
      sans-serif;
  }

  /*
    ======================================================
    PORTADA
    ======================================================
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

    text-transform:
      uppercase;
  }

  .book-cover p {
    margin:
      3.6mm 0 0;

    color:
      #E2CA89;

    font:
      700 6.3pt
      Arial,
      Helvetica,
      sans-serif;

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
    ======================================================
    CANCIONES
    ======================================================
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
      0 0 2.5mm;

    padding-bottom:
      1.8mm;

    border-bottom:
      .35mm solid #D5C18E;
  }

  .song-number {
    flex:
      none;

    color:
      #A88A44;

    font-weight:
      700;
  }

  .song-heading h2 {
    margin:
      0;

    color:
      #352448;

    line-height:
      1.08;

    text-transform:
      uppercase;
  }

  .song-category {
    margin:
      -.8mm 0 1.8mm;

    color:
      #786F66;

    font-family:
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
  }

  .blank-page {
    background:
      #FFFFFF;
  }

  /*
    ======================================================
    IMPRESIÓN
    ======================================================
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
    haz

    <strong>
      un único corte horizontal
    </strong>

    por la línea punteada.

    La línea vertical
    es solamente para doblar.

  </p>

  <h2>
    Doble cara automática
  </h2>

  <p>

    Imprime todas las páginas,

    papel A4,

    escala 100 %,

    doble cara

    y

    <strong>
      voltear por borde largo
    </strong>.

  </p>

  <h2>
    Doble cara manual
  </h2>

  <p>

    Primero imprime
    las páginas

    <strong>
      impares:
      1, 3, 5, 7…
    </strong>.

    Vuelve a colocar
    las hojas

    y luego imprime

    <strong>
      pares:
      2, 4, 6, 8…
    </strong>.

  </p>

  <div
    class="important"
  >

    <strong>
      Haz una prueba
      con una sola hoja
      antes de imprimir todo.
    </strong>

    Si el reverso
    sale invertido,

    cambia la orientación
    con la que vuelves
    a colocar el papel.

  </div>

  <h2>
    Armado
  </h2>

  <p>

    1.
    Corta cada A4
    por la línea horizontal.

    <br>

    2.
    Dobla cada mitad
    por la línea vertical.

    <br>

    3.
    Ordena y anida
    las hojas.

    <br>

    4.
    Engrapa sobre
    el pliegue central.

  </p>

  <p>

    En Chrome desactiva

    <strong>
      Encabezados
      y pies de página
    </strong>.

  </p>

  <button
    type="button"
    onclick="window.print()"
  >

    Imprimir / Guardar como PDF

  </button>

</section>

${hojasImpuestas}


/*
  ======================================================
  AUTOAJUSTE DEL TAMAÑO DE LETRA
  ======================================================

  Esta es la parte nueva.

  Para cada canción:

  - comienza con un tamaño pequeño;
  - aumenta progresivamente;
  - comprueba si sigue entrando;
  - encuentra el mayor tamaño
    que cabe dentro de la página.

  De esta forma:

  canción corta =
  letra grande.

  canción larga =
  letra más pequeña.
*/

<script>

(function () {

  /*
    Tamaño mínimo.

    Solo se utilizará
    en canciones
    realmente largas.
  */

  const MIN_BODY =
    6.0;

  /*
    Tamaño máximo.

    Canciones cortas
    pueden llegar
    hasta 11.2 pt.

    Si después quieres
    todavía más grande,
    puedes poner 12.
  */

  const MAX_BODY =
    11.2;

  /*
    Pequeño margen
    de tolerancia.
  */

  const SAFETY =
    2;


  function aplicarTamano(
    page,
    bodyPt
  ) {

    const text =
      page.querySelector(
        ".song-text"
      );

    const title =
      page.querySelector(
        ".song-heading h2"
      );

    const number =
      page.querySelector(
        ".song-number"
      );

    const category =
      page.querySelector(
        ".song-category"
      );


    /*
      INTERLINEADO DINÁMICO.

      A mayor letra,
      damos un poco
      más de aire.
    */

    let lineHeight;

    if (
      bodyPt >= 10
    ) {
      lineHeight =
        1.34;
    } else if (
      bodyPt >= 8
    ) {
      lineHeight =
        1.29;
    } else {
      lineHeight =
        1.22;
    }


    text.style.fontSize =
      bodyPt + "pt";

    text.style.lineHeight =
      lineHeight;


    /*
      Título proporcional
      al tamaño de la letra.
    */

    const titlePt =
      Math.min(
        14.2,
        Math.max(
          9.5,
          bodyPt * 1.28 + 1.2
        )
      );


    title.style.fontSize =
      titlePt + "pt";


    number.style.fontSize =
      Math.max(
        8.8,
        titlePt * .82
      ) + "pt";


    /*
      Categoría:
      huayno,
      cumbia,
      etc.
    */

    if (category) {

      const categoryPt =
        Math.min(
          7.3,
          Math.max(
            5.8,
            bodyPt * .68
          )
        );

      category.style.fontSize =
        categoryPt + "pt";

      category.style.lineHeight =
        "1.15";
    }
  }


  /*
    Comprueba si
    todo sigue entrando
    dentro de la página.
  */

  function cabe(page) {

    return (
      page.scrollHeight <=
      page.clientHeight +
      SAFETY
    );
  }


  /*
    Búsqueda binaria.

    En vez de probar
    tamaño por tamaño,
    encuentra rápidamente
    el máximo posible.
  */

  function ajustarPagina(page) {

    let low =
      MIN_BODY;

    let high =
      MAX_BODY;

    let best =
      MIN_BODY;


    /*
      Empezamos
      desde el mínimo.
    */

    aplicarTamano(
      page,
      low
    );


    /*
      14 repeticiones
      dan precisión
      de sobra.
    */

    for (
      let i = 0;
      i < 14;
      i += 1
    ) {

      const mid =
        (low + high) / 2;


      aplicarTamano(
        page,
        mid
      );


      if (
        cabe(page)
      ) {

        best =
          mid;

        low =
          mid;

      } else {

        high =
          mid;
      }
    }


    /*
      Restamos una mínima
      cantidad para evitar
      que una diferencia
      del navegador
      corte la última línea.
    */

    aplicarTamano(
      page,
      Math.max(
        MIN_BODY,
        best - .08
      )
    );
  }


  function ajustarTodas() {

    document
      .querySelectorAll(
        ".song-page"
      )
      .forEach(
        ajustarPagina
      );
  }


  /*
    Esperamos a que
    las fuentes estén listas
    antes de medir.
  */

  async function iniciar() {

    if (
      document.fonts &&
      document.fonts.ready
    ) {
      try {

        await document
          .fonts
          .ready;

      } catch (_) {
        // No pasa nada.
      }
    }


    ajustarTodas();
  }


  /*
    Ejecutamos al cargar.
  */

  window.addEventListener(
    "load",
    iniciar,
    {
      once: true
    }
  );


  /*
    Segunda ejecución
    por seguridad,
    especialmente
    en Chrome.
  */

  setTimeout(
    iniciar,
    250
  );

})();

<\/script>


</body>

</html>
  `);

  ventana.document.close();
}


/*
  ======================================================
  BOTÓN PDF
  ======================================================
*/

generarPdf.addEventListener(
  "click",
  generarLibro
);


/*
  ======================================================
  CARGAR CANCIONES
  ======================================================
*/

cargarCanciones();
