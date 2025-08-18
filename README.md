# PhytoScan IA – Web App

Aplicación de diagnóstico fitosanitario con **React 18 + TailwindCSS + Framer Motion + Leaflet + Supabase**.

---

## 🚀 Requisitos
- Node.js 18+
- npm 9+ / yarn 1+

## ⚙️ Variables de Entorno
Crea un archivo `.env.local` basado en `.env.example` con:
```bash
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
```

## 📦 Instalación
```bash
npm install
npm start   # modo desarrollo
npm run build  # build de producción
```

## 📂 Estructura del proyecto
```
src/
  components/   # UI (Auth, Chatbot, Map, etc.)
  api/          # integraciones (OpenAI, etc.)
  lib/          # supabaseClient.js
  styles/       # estilos Tailwind
public/
```

## 🔗 Conexión Supabase
La app usa `src/supabaseClient.js` para conectar con la base de datos.  
Todas las operaciones se realizan con `supabase.from(<tabla>)...`.

Tablas principales (ver `docs/db.md`):
- `catalog_entries`
- `chatbot_messages`
- `reports`

## 📖 Documentación adicional
- [`docs/db.md`](docs/db.md) → Base de datos y diagrama ER
- [`docs/guia-rapida.md`](docs/guia-rapida.md) → Guía rápida de usuario
- [`CONTRIBUTING.md`](CONTRIBUTING.md) → Flujo de trabajo Git

---
