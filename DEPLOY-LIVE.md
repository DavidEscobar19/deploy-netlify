# Datos en vivo — puesta en marcha (Opción A)

La web ya trae el panel **"En directo"** y una función de servidor que trae cuotas y
resultados reales. Para encenderlo necesitas 3 cosas, una sola vez.

## 1. Clave de la API (gratis)

1. Entra en https://the-odds-api.com y crea una cuenta.
2. Copia tu **API key** (plan gratis: 500 consultas/mes — de sobra: la web consulta
   1 vez cada 5 minutos y solo mientras la tengas abierta).

## 2. Desplegar CON funciones (ya no vale arrastrar el HTML)

Arrastrar el archivo **no ejecuta la función**. Hay que subir la carpeta con la
estructura completa (`index.html`, `_headers`, `netlify.toml`, `netlify/functions/live.js`).
Dos formas:

**Opción rápida — Netlify CLI**
```
npm install -g netlify-cli
cd "carpeta deploy-netlify"
netlify deploy --prod
```

**Opción cómoda — Git**
Sube la carpeta a un repo de GitHub y en Netlify → *Add new site → Import from Git*.
Cada `git push` redepliega solo.

## 3. Meter la clave en Netlify (secreta, nunca en el HTML)

Netlify → **Site settings → Environment variables → Add a variable**
- Key: `ODDS_API_KEY`
- Value: *tu clave*

(Opcional) `ODDS_SPORT` si quieres forzar otro torneo. Por defecto: `soccer_fifa_world_cup`.

Vuelve a desplegar. Listo: el panel "En directo" mostrará marcadores y cuotas reales,
y se refresca solo cada 5 minutos.

## 4. Segunda clave — datos deportivos reales (football-data.org)

El panel **"Resultados reales"** usa otra API (resultados, calendario, clasificación,
goleadores). Necesita su propia clave, en otra variable de entorno.

> Nota: se probó primero con API-Football, pero su plan gratis no da acceso a la
> temporada 2026 (solo temporadas viejas). football-data.org sí cubre el Mundial en
> su plan gratis (10 consultas/min).

1. Crea cuenta gratis en https://www.football-data.org/client/register.
2. Copia tu API key (te la mandan o aparece en tu panel de cliente).
3. Netlify → **Environment variables** → añade:
   - Key: `FOOTBALL_DATA_KEY`  ·  Value: *tu clave*
   - (Opcional) `FD_COMPETITION` (por defecto `WC` = Copa del Mundo) y `FD_SEASON` (por defecto `2026`).
4. Redespliega (o `git push`).

Comprobar: abre `https://TU-SITIO/.netlify/functions/football` → JSON con `"ok": true` y `response` con partidos.

## Comprobar que va

- Abre `https://TU-SITIO/.netlify/functions/live` en el navegador: debe devolver JSON
  con `"ok": true`. Si pone `"NO_API_KEY"`, falta el paso 3.
- Si el Mundial no está en temporada, `odds` puede venir vacío: es normal, no es un fallo.

## Nota de seguridad

La clave vive solo en la variable de entorno del servidor. El navegador nunca la ve;
solo habla con `/.netlify/functions/live`, que es tuya. Por eso hace falta la función:
una web estática no puede guardar secretos.
