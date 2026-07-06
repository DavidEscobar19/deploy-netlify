# Criterio — Puesta en marcha pública (checklist)

La web ya es **pública** (sin PIN), tiene **aviso beta**, **apartado para reportar fallos**,
**páginas legales** (aviso legal, privacidad/cookies, juego responsable +18) y la
**integración de Google AdSense** lista. Estos son los pasos que dependen de ti.

## 1. Reportes de fallos (Netlify Forms)
- En Netlify → tu sitio → **Forms**: comprueba que la detección de formularios está activa.
- Tras el primer despliegue, envía un reporte de prueba desde la web. Debe aparecer en
  **Forms → reporte-fallos**.
- (Opcional) Netlify → **Forms → Form notifications**: activa el aviso por email a tu correo
  para enterarte al instante de cada reporte.

## 2. Google AdSense
- Tu ID ya está puesto: `ca-pub-7724031547464587` (loader en el `<head>` + `ads.txt` en la raíz).
- **Aprobación:** entra en tu panel de AdSense, añade el sitio y pide la revisión. Los anuncios
  **no se muestran hasta que Google apruebe** el sitio (puede tardar días).
- **Aviso importante (apuestas):** AdSense tiene una política estricta con contenido de
  juego/apuestas. Puede rechazar el sitio o suspender la cuenta si no cumples. Revisa la
  política de «Juego y apuestas» de AdSense antes de nada.
- **Cookies / consentimiento (EEE, RU, Suiza y California):** en AdSense →
  **Privacidad y mensajes** crea y publica los mensajes de **RGPD** y **CCPA** (CMP de Google).
  Es obligatorio para mostrar anuncios personalizados con consentimiento.
- **Formatos:**
  - *Auto ads* (recomendado para empezar): actívalos en AdSense y Google coloca los anuncios
    solo. Para que sean «pequeños», limita la densidad en la configuración de Auto ads.
  - *Unidades manuales*: si prefieres controlar el tamaño/lugar, crea unidades de anuncio en
    AdSense, copia su **ID de slot** y pégalo en los `data-slot=""` de `index.html`
    (hay huecos preparados en Inicio y Análisis). Mientras estén vacíos no se muestra nada.

## 3. Dominio propio y profesional
No puedo comprarlo yo. Pasos:
1. Registra un dominio con el nombre (ideas): **criterio.bet**, **criterio.app**,
   **criteriomundial.com**, **usacriterio.com**, **appcriterio.com**, **criterio.futbol**.
   (Comprueba disponibilidad en tu registrador: Namecheap, Google Domains/Squarespace, Porkbun…)
2. En Netlify → tu sitio → **Domain management → Add a custom domain** → escribe tu dominio.
3. Sigue las instrucciones de DNS (apuntar los registros a Netlify o usar sus nameservers).
   Netlify emite el **certificado HTTPS** automático.
4. Actualiza el `ads.txt` no hace falta (es por editor, no por dominio), pero vuelve a pedir la
   revisión de AdSense con el dominio final.

## 4. Personaliza lo legal (obligatorio antes de abrir del todo)
En `index.html`, sección **Información legal**:
- «Titular»: pon tu nombre o entidad y un email de contacto real.
- Revisa el texto de privacidad/cookies y adáptalo a tu caso (RGPD/LOPDGDD y regulación de juego).
- **Recomendación honesta:** que un profesional legal revise los textos antes de monetizar con
  tráfico público.

## 5. SEO básico
- Ya está `robots: index,follow` y una meta-descripción. Cuando tengas el dominio, registra el
  sitio en **Google Search Console** y envía la URL para que se indexe.
