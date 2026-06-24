# IgniLMB

Landing page de posiciones de la Liga Mexicana de Beisbol para la temporada 2026. El sitio consume datos en vivo desde MLB Stats API y renderiza la informacion de forma dinamica, sin datos estaticos de equipos o posiciones.

## Objetivo

El proyecto muestra una landing responsiva para consultar:

- Lider general de la liga.
- KPIs principales de temporada.
- Posiciones por Division Norte y Division Sur.
- Busqueda por equipo o ciudad.
- Ordenamiento por ranking, victorias o porcentaje.
- Detalle de estadisticas por equipo en un drawer lateral.
- Top 5 por division.

## Tecnologias

- HTML, CSS y JavaScript vanilla.
- MLB Stats API como fuente de datos.
- Configuracion publica en JSON.
- PWA basica mediante `manifest.json`.
- Apache opcional mediante `.htaccess`.
- Script local de Node.js para minificar CSS.

No requiere framework, bundler ni backend propio.

## Estructura del proyecto

```text
IgniLMB/
  index.html
  README.md
  manifest.json
  robots.txt
  sitemap.xml
  .htaccess
  minify-css.js
  data/
    config.json
  css/
    reset.css
    reset.min.css
    variables.css
    variables.min.css
    main.css
    main.min.css
  js/
    api.js
    ui.js
    main.js
  assets/
    img/
      logoLMB.png
      og-cover.svg
    icons/
      icon.svg
    fonts/
```

## Como ejecutar en local

El sitio debe servirse desde un servidor local, no abriendo el HTML directamente, porque `fetch()` necesita cargar `data/config.json`.

Desde la carpeta `IgniLMB`:

```bash
python -m http.server 8080
```

Luego abrir:

```text
http://localhost:8080
```

Tambien puede usarse Live Server o cualquier servidor estatico.

## Configuracion

La configuracion publica vive en:

```text
data/config.json
```

Ejemplo actual:

```json
{
  "site": {
    "name": "LMB 2026 - Posiciones Temporada",
    "url": "https://ignilmb.example.com/",
    "description": "Consulta las posiciones de la Liga Mexicana de Beisbol 2026 por division, porcentaje, victorias, rachas y splits de temporada."
  },
  "league": {
    "id": 125,
    "name": "Liga Mexicana de Beisbol",
    "season": "2026"
  },
  "api": {
    "standingsEndpoint": "https://statsapi.mlb.com/api/v1/standings?leagueId=125&season=2026",
    "timeoutMs": 12000
  }
}
```

Notas importantes:

- `api.standingsEndpoint` controla la fuente de posiciones.
- `api.timeoutMs` define cuanto espera el frontend antes de mostrar error.
- Este archivo es publico. No agregar API keys, tokens ni secretos.
- Si cambia la temporada, actualizar `league.season` y el parametro `season` del endpoint.

## Flujo de carga

1. `index.html` carga estilos minificados y scripts.
2. `main.js` inicia la aplicacion al evento `DOMContentLoaded`.
3. `ui.renderLoadingState()` muestra estados iniciales mientras cargan datos.
4. `api.fetchStandings()` carga `data/config.json`.
5. `api.fetchStandings()` consulta MLB Stats API.
6. `api.normalizeRecordsPayload()` transforma la respuesta externa en un formato interno.
7. `ui.setStandings()` guarda equipos y metadatos en estado.
8. `ui.renderShell()` actualiza hero, loader, KPIs, conteos y footer.
9. `ui.renderAll()` renderiza posiciones y filtros.
10. `ui.buildTop5()` renderiza top 5 por division.

## JavaScript

### `js/api.js`

Capa de datos. Se encarga de cargar configuracion, consultar el API y normalizar la respuesta.

Funciones principales:

- `loadConfig()`: carga `data/config.json`.
- `fetchStandings(endpoint)`: obtiene posiciones desde el endpoint configurado.
- `fetchTeams(endpoint)`: devuelve solo el arreglo de equipos normalizados.
- `normalizeRecordsPayload(payload, endpoint, config)`: convierte la respuesta de MLB Stats API al formato usado por la UI.
- `logoUrl(id)`: genera la URL del logo de cada equipo.
- `logoFallback`: logo alternativo si falla un escudo.

Formato interno de equipo:

```js
{
  id,
  fullName,
  n,
  city,
  div,
  rank,
  w,
  l,
  pct,
  gb,
  rd,
  rn,
  rw,
  hm,
  aw,
  last10
}
```

Manejo de errores en `api.js`:

- Timeout: `La consulta tardo demasiado...`
- Conexion fallida: `No se pudo conectar...`
- JSON invalido: `El servicio respondio con datos que no se pudieron leer.`
- HTTP no exitoso: `El servicio de posiciones respondio con codigo ...`
- Respuesta sin registros: `La respuesta del servicio no contiene registros de posiciones.`
- Respuesta sin equipos: `La respuesta del servicio no contiene equipos.`

### `js/ui.js`

Capa visual. Todo lo que se renderiza en pantalla se construye desde el estado normalizado.

Responsabilidades:

- Mantener `state.teams`, `state.meta`, `state.error` y `state.sortK`.
- Renderizar loader y estado de carga.
- Renderizar hero y lider de liga.
- Renderizar KPIs.
- Renderizar posiciones por division.
- Aplicar busqueda, filtro por division y ordenamiento.
- Construir marquee de equipos.
- Abrir/cerrar drawer de detalle.
- Mostrar top 5 por division.
- Normalizar mensajes de error visibles.

Funciones principales:

- `setStandings(standings)`: guarda datos normalizados.
- `renderLoadingState()`: pinta el estado inicial.
- `renderShell()`: actualiza bloques principales.
- `renderError(error)`: muestra errores en loader, hero, KPIs, posiciones y footer.
- `renderAll()`: renderiza posiciones con filtros actuales.
- `applyF()`: aplica busqueda/filtro.
- `setS(key)`: cambia el ordenamiento desde el desplegable.
- `openDr(id)`: abre el drawer de un equipo.
- `buildMarquee()`: crea carrusel de logos.
- `buildTop5()`: crea ranking top 5 por division.

### `js/main.js`

Bootstrap de la app.

Responsabilidades:

- Exponer handlers usados por atributos inline del HTML.
- Escuchar scroll y tecla Escape.
- Iniciar carga de datos.
- Mostrar la app aun mientras el API responde.
- Pasar errores a `ui.renderError()`.

## HTML

`index.html` contiene:

- Metadatos SEO.
- Open Graph y Twitter Card.
- Datos estructurados JSON-LD.
- Links a CSS minificado.
- Loader inicial.
- Toast de lider.
- Modal de recuperacion.
- Drawer de detalle.
- Navbar.
- Hero.
- Marquee de equipos.
- KPIs.
- Posiciones.
- Top 5.
- Footer.

Los textos iniciales son placeholders. Cuando el API responde, `ui.js` reemplaza el contenido con datos reales.

## CSS

Los estilos fuente estan en:

- `css/reset.css`: reset basico.
- `css/variables.css`: tokens globales de color, tipografias, radios y easings.
- `css/main.css`: layout, componentes, animaciones y responsive.

El sitio carga los archivos minificados:

- `css/reset.min.css`
- `css/variables.min.css`
- `css/main.min.css`

Despues de modificar CSS fuente, regenerar minificados:

```bash
node minify-css.js
```

## Responsive

Breakpoints principales:

- `1024px+`: layout desktop amplio, posiciones en 2 columnas, KPIs en 4 columnas.
- `768px+`: posiciones en 2 columnas para tablet.
- `640px+`: KPIs y top 5 en 2 columnas.
- `425px+`: KPIs y estadisticas del drawer en 2 columnas.
- `424px-`: KPIs y drawer vuelven a 1 columna para evitar compresion.
- `680px-`: navbar movil solo con logo centrado, sin links.
- `480px-`: ajustes finos de hero, cards, drawer y espacios.
- `360px-`: compactacion para telefonos chicos.

## Manejo de errores

El sitio no usa datos falsos si falla el API. En caso de error:

- Se limpian equipos del estado.
- Se muestra el mensaje en hero, loader, KPIs y posiciones.
- El footer indica que no se pudieron actualizar los datos.
- Los mensajes tecnicos del navegador se traducen antes de mostrarse.

Ejemplos de mensajes visibles:

- `No se pudo conectar con el servicio de posiciones. Revisa tu conexion e intentalo de nuevo.`
- `La consulta tardo demasiado. Intentalo de nuevo en unos segundos.`
- `El servicio respondio con datos que no se pudieron leer.`
- `No se pudieron actualizar los datos.`

## SEO y PWA

Archivos relacionados:

- `manifest.json`: configuracion PWA basica e icono oficial.
- `robots.txt`: directivas para bots.
- `sitemap.xml`: URL principal del sitio.
- `assets/img/og-cover.svg`: imagen para previews sociales.
- `index.html`: title, description, canonical, Open Graph, Twitter Card y JSON-LD.

Antes de produccion, actualizar:

- Dominio real en `index.html`.
- Dominio real en `sitemap.xml`.
- Dominio real en `robots.txt` si aplica.
- Dominio real en `data/config.json`.
- `og:image` si se cambia el asset social.

## Apache y despliegue

`.htaccess` aplica cuando el sitio se sirve con Apache y `AllowOverride` esta habilitado.

Incluye:

- `DirectoryIndex index.html`
- `Options -Indexes`
- Charset UTF-8.
- Compresion para HTML, CSS, JS, JSON, XML y SVG.
- Redireccion a HTTPS.
- Fallback a `index.html` para rutas limpias.
- Headers de seguridad.
- Cache para archivos estaticos.

En servidores que no usen Apache, replicar estas reglas en la configuracion equivalente.

## Comandos utiles

Validar JavaScript:

```bash
node --check js/api.js
node --check js/ui.js
node --check js/main.js
```

Minificar CSS:

```bash
node minify-css.js
```

Levantar servidor local:

```bash
python -m http.server 8080
```

Buscar referencias:

```bash
rg "texto-a-buscar"
```

## Mantenimiento

Para cambiar temporada:

1. Editar `data/config.json`.
2. Actualizar `league.season`.
3. Actualizar `api.standingsEndpoint`.
4. Revisar textos SEO en `index.html`.
5. Actualizar `sitemap.xml` si cambia el dominio o fecha.

Para cambiar estilos:

1. Editar archivos fuente en `css/`.
2. Ejecutar `node minify-css.js`.
3. Probar mobile, tablet y desktop.

Para cambiar mensajes:

1. Estados iniciales: `index.html`.
2. Mensajes dinamicos: `js/ui.js`.
3. Errores de red/API: `js/api.js`.

## Consideraciones

- El proyecto depende de disponibilidad de MLB Stats API.
- No hay backend propio ni persistencia local.
- Los logos de equipos se cargan desde `mlbstatic.com`.
- El logo oficial de LMB usado por la landing esta en `assets/img/logoLMB.png`.
- El sitio debe correr servido por HTTP/HTTPS para que `fetch()` cargue correctamente la configuracion.
