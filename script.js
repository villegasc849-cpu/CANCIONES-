const listaCanciones = document.querySelector("#lista-canciones");
const buscador = document.querySelector("#buscador");
const contador = document.querySelector("#contador");
const sinResultados = document.querySelector("#sin-resultados");
const limpiarBusqueda = document.querySelector("#limpiar-busqueda");
const cerrarTodo = document.querySelector("#cerrar-todo");

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

renderizarCanciones(canciones);
