// src/components/Gallery.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { motion, AnimatePresence } from "framer-motion";
// --- MEJORA 3: Importar iconos para el nuevo estilo ---
import {
  Loader2,
  AlertTriangle,
  Bean,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
} from "lucide-react";

// --- Configuración ---
const BUCKET = "dataset_agricola";
const ROOT_CROP = "frijol";
const TAXA = ["abiotic", "bacteria", "fungi", "insect", "mite", "nematode"];
const MAX_IMAGES_PER_DISEASE = 5;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
// --- MEJORA 2: Constante para el tamaño de página ---
const ITEMS_PER_PAGE = 12;
// --- MEJORA 1: Claves para el cache y tiempo de expiración (1 hora) ---
const CACHE_KEY_DATA = "gallery_data_cache";
const CACHE_KEY_URLS = "gallery_urls_cache";
const CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hora en milisegundos

// --- Helpers ---
function norm(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^\w]+/g, "_").trim();
}

// --- MEJORA 1: Función para firmar URLs con cache ---
async function signMany(paths, expires = 3600) {
  if (!paths.length) return [];

  // Intentar obtener URLs del cache primero
  const cachedUrls = JSON.parse(localStorage.getItem(CACHE_KEY_URLS) || "{}");
  const now = Date.now();
  const urlsToReturn = {};
  const pathsToSign = [];

  for (const path of paths) {
    if (cachedUrls[path] && cachedUrls[path].expires > now) {
      urlsToReturn[path] = cachedUrls[path].url;
    } else {
      pathsToSign.push(path);
    }
  }

  // Si no todas las URLs estaban en el cache, firmar las que faltan
  if (pathsToSign.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(pathsToSign, expires);
    if (error) {
      console.warn("createSignedUrls error:", error.message);
    } else {
      data.forEach((d, i) => {
        if (d?.signedUrl) {
          const path = pathsToSign[i];
          urlsToReturn[path] = d.signedUrl;
          // Guardar la nueva URL en el cache con fecha de expiración
          cachedUrls[path] = {
            url: d.signedUrl,
            expires: now + CACHE_EXPIRATION,
          };
        }
      });
    }
  }

  localStorage.setItem(CACHE_KEY_URLS, JSON.stringify(cachedUrls));
  return paths.map(path => urlsToReturn[path] || null);
}

export default function Gallery() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState("");

  const [taxon, setTaxon] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [slide, setSlide] = useState(0);

  // --- MEJORA 2: Estado para la paginación ---
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchMedia = useCallback(async (activeTaxon, activeQuery) => {
    // --- MEJORA 1: Estrategia Cache-First ---
    const cachedData = JSON.parse(localStorage.getItem(CACHE_KEY_DATA));
    if (cachedData) {
      setCards(cachedData); // Mostrar datos cacheados inmediatamente
      setLoading(false);
    }

    try {
      let qb = supabase
        .from("media_assets")
        .select("path, cultivo, taxon, enfermedad_slug, title, descripcion, sort_order, is_cover")
        .eq("bucket", BUCKET)
        .eq("cultivo", ROOT_CROP)
        .order("enfermedad_slug")
        .order("is_cover", { ascending: false })
        .order("sort_order")
        .limit(5000);

      if (activeTaxon && activeTaxon !== "all") {
        qb = qb.eq("taxon", activeTaxon);
      }
      const { data, error } = await qb;
      if (error) throw error;

      // --- El resto del procesamiento es igual, pero ahora sobre 'data' en vez de 'cards' ---
      const onlyImages = (data || []).filter(r => IMAGE_EXT.test(r.path));
      const words = norm(activeQuery || "").split("_").filter(Boolean);

      const filtered = onlyImages.filter(r => {
        if (!words.length) return true;
        const hay = (r.enfermedad_slug || "") + " " + (r.title || "") + " " + (r.taxon || "");
        const target = norm(hay);
        return words.every(w => target.includes(w));
      });

      const byDisease = new Map();
      for (const row of filtered) {
        const key = row.enfermedad_slug || "_";
        if (!byDisease.has(key)) byDisease.set(key, []);
        byDisease.get(key).push(row);
      }

      let grouped = [];
      const pathsToSign = [];
      const signIndex = new Map();

      for (const [slug, rows] of byDisease.entries()) {
        const chosen = [...rows.filter(r => r.is_cover), ...rows.filter(r => !r.is_cover)].slice(0, MAX_IMAGES_PER_DISEASE);
        if (!chosen.length) continue;

        const card = {
          key: slug,
          cultivo: chosen[0]?.cultivo || ROOT_CROP,
          taxon: chosen[0]?.taxon || "",
          enfermedad: slug.replace(/_/g, " "),
          descripcion: chosen.find(r => r.descripcion)?.descripcion || "Sin descripción",
          images: chosen.map(r => ({ path: r.path, name: r.title || r.path.split("/").pop() })),
          cover: null,
        };
        
        chosen.forEach(img => {
            if (!signIndex.has(img.path)) {
                pathsToSign.push(img.path);
                signIndex.set(img.path, []);
            }
            signIndex.get(img.path).push(card);
        });

        grouped.push(card);
      }

      const signedUrls = await signMany(pathsToSign);
      const urlMap = new Map(pathsToSign.map((path, i) => [path, signedUrls[i]]));
      
      grouped.forEach(card => {
        card.images.forEach(img => {
            img.url = urlMap.get(img.path);
        });
        card.cover = card.images[0]?.url || null;
      });

      grouped.sort((a, b) => a.taxon.localeCompare(b.taxon) || a.enfermedad.localeCompare(b.enfermedad));
      
      // Actualizar el estado y guardar en cache
      setCards(grouped);
      localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(grouped));

    } catch (e) {
      console.error("Galería (media_assets):", e);
      if (!cachedData) { // Solo mostrar error si no hay datos cacheados
        setError(e.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia(taxon, q);
  }, [fetchMedia, taxon, q]);
  
  // --- MEJORA 2: Lógica de Paginación ---
  const totalPages = Math.max(1, Math.ceil(cards.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedCards = cards.slice(pageStart, pageEnd);

  // Resetear la página a 1 cuando cambian los filtros
  useEffect(() => {
    setPage(1);
  }, [taxon, q]);

  const currentCard = useMemo(() => open ? cards.find(c => c.key === currentIdx) : null, [cards, currentIdx, open]);

  const openModal = (key) => { setCurrentIdx(key); setSlide(0); setOpen(true); };
  const closeModal = () => setOpen(false);
  const next = () => currentCard && setSlide((s) => (s + 1) % currentCard.images.length);
  const prev = () => currentCard && setSlide((s) => (s - 1 + currentCard.images.length) % currentCard.images.length);

  // --- MEJORA 3: Aplicar nueva estructura y clases de estilo ---
  return (
    <motion.div
      className="bg-gradient-to-br from-emerald-50 via-cyan-50 to-sky-50 p-6 md:p-8 rounded-3xl shadow-xl border border-emerald-200 max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-3xl font-bold text-emerald-800 flex items-center gap-2 mb-4">
        <Bean className="w-7 h-7 text-cyan-500" />
        Galería — {ROOT_CROP}
      </h2>

      <div className="bg-white/70 rounded-2xl border border-emerald-200 p-3 md:p-4 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
                <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    className="pl-9 w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
                    placeholder="Buscar enfermedad…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <select
                className="border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                value={taxon}
                onChange={(e) => setTaxon(e.target.value)}
            >
                <option value="all">Todos los taxones</option>
                {TAXA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
        <div className="mt-3 text-sm text-emerald-800">
            Mostrando <b>{cards.length === 0 ? 0 : pageStart + 1}</b>–<b>{Math.min(pageEnd, cards.length)}</b> de <b>{cards.length}</b> resultados
        </div>
      </div>

      {loading && <div className="flex justify-center items-center py-10 text-emerald-700"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando galería...</div>}
      {!loading && error && <div className="flex justify-center items-center py-10 text-red-600"><AlertTriangle className="w-6 h-6 mr-2" /> Error: {error}</div>}
      {!loading && !error && paginatedCards.length === 0 && <div className="text-center text-emerald-800 py-10">No hay resultados con los filtros actuales.</div>}

      {!loading && !error && (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {paginatedCards.map((card) => (
                <motion.div
                key={card.key}
                className="bg-white border border-emerald-200 rounded-2xl shadow hover:shadow-lg transition cursor-pointer"
                whileHover={{ y: -5 }}
                onClick={() => openModal(card.key)}
                >
                {card.cover
                    ? <img src={card.cover} alt={card.enfermedad} className="w-full h-40 object-cover rounded-t-2xl" />
                    : <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-t-2xl text-emerald-600"><Bean className="w-10 h-10" /></div>}
                <div className="p-4">
                    <h3 className="font-semibold text-emerald-800 capitalize truncate">{card.enfermedad}</h3>
                    <p className="text-xs text-gray-500">{card.taxon} • {card.images.length} foto{card.images.length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{card.descripcion}</p>
                </div>
                </motion.div>
            ))}
            </div>

            {/* --- MEJORA 2: Controles de Paginación --- */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-8">
                <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <span className="text-emerald-800 font-semibold">
                    Página {page} de {totalPages}
                </span>
                <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                >
                    Siguiente <ChevronRight className="w-4 h-4" />
                </button>
                </div>
            )}
        </>
      )}
      
      {/* Modal / Carrusel (ya estaba bien, solo pequeños ajustes de estilo) */}
      <AnimatePresence>
        {open && currentCard && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
            <motion.div
              className="bg-white rounded-3xl shadow-xl max-w-3xl w-full overflow-hidden relative"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()} // Evita que el modal se cierre al hacer clic dentro
            >
              <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-semibold capitalize">{currentCard.enfermedad}</h3>
                <button onClick={closeModal} className="text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              {currentCard.images.length > 0 && (
                <div className="relative bg-black">
                  <img src={currentCard.images[slide]?.url} alt={currentCard.images[slide]?.name} className="w-full max-h-[60vh] object-contain" />
                  {currentCard.images.length > 1 && <>
                    <button onClick={prev} className="absolute top-1/2 left-4 -translate-y-1/2 bg-emerald-600/80 hover:bg-emerald-700 text-white p-2 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={next} className="absolute top-1/2 right-4 -translate-y-1/2 bg-emerald-600/80 hover:bg-emerald-700 text-white p-2 rounded-full"><ChevronRight className="w-5 h-5" /></button>
                  </>}
                </div>
              )}
              
              <div className="p-3 text-center text-sm text-gray-500">{slide + 1} / {currentCard.images.length}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}