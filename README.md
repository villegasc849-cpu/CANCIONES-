# Cancionero del Señor Cautivo de Ayabaca

Sitio web estático, responsive y sin frameworks para publicar un cancionero
digital. Funciona en GitHub Pages y también al abrir `index.html` directamente.
Actualmente incluye las 73 canciones con letra del archivo `CANCIONERO.pdf`.

## Archivos

- `index.html`: estructura principal del sitio.
- `style.css`: diseño, colores y adaptación para celulares.
- `script.js`: acordeón, búsqueda y contador.
- `canciones.js`: contenido editable de las canciones.
- `assets/`: fotografías usadas en la portada.

## Agregar canciones

Edita `canciones.js` y añade un nuevo objeto dentro del arreglo:

```js
const canciones = [
  {
    numero: "01",
    titulo: "HIMNO",
    letra: `
Texto de la canción
con saltos de línea reales

Segunda estrofa
`,
    youtube: "",
    inicio: 0
  },
  {
    numero: "02",
    titulo: "OTRO CANTO",
    letra: `
Letra del segundo canto
`,
    youtube: "https://www.youtube.com/watch?v=VIDEO_ID",
    inicio: 0
  }
];
```

El campo `youtube` acepta una URL completa o el identificador del video.
`inicio` indica, en segundos, desde qué momento debe comenzar la reproducción.
Déjalos como `""` y `0` cuando no quieras mostrar el enlace de YouTube.

## Uso local

Abre `index.html` en cualquier navegador moderno. No se necesita instalar nada
ni ejecutar un servidor para consultar las letras y usar la búsqueda.

YouTube exige que los reproductores incrustados se abran desde una dirección
web con `http://` o `https://`. Por ello, al abrir `index.html` directamente los
videos ofrecen un enlace de respaldo. Una vez publicado en GitHub Pages, los
videos se reproducen dentro de cada canción.

## Publicar en GitHub Pages

1. Sube los cinco archivos a la rama principal de un repositorio de GitHub.
2. Ve a **Settings > Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama principal, la carpeta `/ (root)` y guarda los cambios.

La búsqueda compara número, título y letra, ignorando mayúsculas, minúsculas y
tildes.
