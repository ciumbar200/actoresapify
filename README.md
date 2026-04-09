# Apify Multi-source Public Monitor

Actor de Apify para monitoreo de contenido publico en Wallapop, Facebook Marketplace, Instagram y TikTok.

## Stack
- Node.js 20+
- Apify SDK (`apify`)
- Crawlee + Playwright

## Estructura
- `src/main.js`: orquestacion del actor
- `src/sources/wallapop.js`
- `src/sources/facebook.js`
- `src/sources/instagram.js`
- `src/sources/tiktok.js`
- `src/normalize.js`: contrato de salida
- `src/output.js`: deduplicacion y limites por fuente
- `src/input-schema.json`: input de Apify

## Input
```json
{
  "sources": ["wallapop", "facebook", "instagram", "tiktok"],
  "queries": ["iphone", "bicicleta"],
  "location": {
    "country": "ES",
    "region": "Cataluna",
    "city": "Barcelona",
    "radiusKm": 25
  },
  "maxItemsPerSource": 30,
  "startUrls": {
    "wallapop": [],
    "facebook": [],
    "instagram": [],
    "tiktok": []
  },
  "proxy": {
    "useApifyProxy": true,
    "apifyProxyGroups": []
  },
  "debug": false
}
```

## Output dataset
Cada item publicado en dataset incluye:
- `source`, `sourceItemId`, `url`, `title`, `description`, `price`, `currency`
- `sellerName`, `sellerId`, `locationText`
- `publishedAt`, `scrapedAt`
- `images`, `metrics`, `raw`, `query`

## Desarrollo local
```bash
npm install
npm test
npm start
```

## Deploy GitHub -> Apify
1. Crear repo en GitHub y subir este proyecto.
2. En Apify Console: `Actors -> Create new -> Source code from Git repository`.
3. Pegar URL del repo y rama principal (`main`).
4. Guardar y ejecutar build.
5. Correr actor con input ejemplo y revisar dataset.

## Notas importantes
- V1 usa solo contenido publico (sin login).
- Algunas plataformas pueden bloquear scraping por region/rate-limit; el actor degrada por fuente y continua con las demas.
- Para estabilidad en produccion, usar `Apify Proxy` y ajustar concurrencia.
