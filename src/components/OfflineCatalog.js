import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  AlertTriangle,
  Bean,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Filter,
  // --- Nuevos Iconos ---
  Layers, // Para Taxonomía
  FlaskConical, // Para Controles
  BookOpen, // Para Referencias
  Droplets, // Para Síntomas
  Info, // Para Detalles
  Dna, // Icono para la Taxonomía
  Thermometer, // Icono para Severidad
  // --- Fin Nuevos Iconos ---
} from "lucide-react";

// NOTA: Se asume que este archivo existe y exporta la instancia configurada.
import { supabase } from '../lib/supabaseClient.js'; 
import useOfflineCatalog from "../hooks/useOfflineCatalog.js"; // Ruta corregida según su estructura


// ======= Config =======
// CRÍTICO: Aseguramos el uso de la variable de entorno o el valor por defecto 'dataset_agricola'
const DEFAULT_BUCKET =
  process.env.REACT_APP_SUPABASE_IMAGES_BUCKET ||
  process.env.REACT_APP_DATASET_BUCKET ||
  "dataset_agricola";
const ITEMS_PER_PAGE_OPTIONS = [12, 16, 24]; // Ampliado
const DEFAULT_PAGE_SIZE = 12;

// ======= Helpers =======
const classNames = (...c) => c.filter(Boolean).join(" ");

const sevColor = (sev) => {
  const s = (sev || "").toLowerCase().trim();
  if (s === "severo") return "bg-red-100 text-red-700 border-red-200";
  if (s === "moderado") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "leve") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "desconocida") return "bg-gray-100 text-gray-600 border-gray-200"; // Añadido
  return "bg-gray-100 text-gray-600 border-gray-200";
};

const normalize = (v) =>
  (v || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// CRÍTICO: Función que limpia el path.
const cleanPath = (path, bucket) => {
  if (!path) return "";
  let p = path;
  if (p.startsWith(bucket + "/")) p = p.slice(bucket.length + 1);
  if (p.startsWith("/")) p = p.slice(1);
  return p;
};

// CRÍTICO: Función para obtener la URL firmada
const createSigned = async (pathInBucket, bucket) => {
  if (!supabase) return null;
  try {
    const cleanP = cleanPath(pathInBucket, bucket);
    
    if (!cleanP || cleanP.trim() === '') {
        return null;
    }
    
    // Generar URL firmada por 1 hora (60 * 60 segundos)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanP, 60 * 60); 

    if (error) {
      console.error("Signed URL error for path:", cleanP, error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.error("Signed URL exception:", e);
    return null;
  }
};

// Componente para la barra de pestañas (modal)
const TabButton = ({ isActive, icon: Icon, onClick, children }) => (
    <button
        onClick={onClick}
        className={classNames(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
            isActive
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
        )}
    >
        <Icon className="w-4 h-4" />
        {children}
    </button>
);


const OfflineCatalog = () => {
  const { catalog, loading, error } = useOfflineCatalog(); 

  // ======= UI State =======
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Filters
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [sevFilter, setSevFilter] = useState("Todos");
  const [cropFilter, setCropFilter] = useState("Todos");
  const [classFilter, setClassFilter] = useState("Todos");

  // Modal + Carousel
  const [selected, setSelected] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('detalles'); // Estado para las pestañas del modal

  // Signed URL caches
  const [thumbCache, setThumbCache] = useState({}); // {path: url}
  const [carouselCache, setCarouselCache] = useState({}); // {path: url}

  const bucket = DEFAULT_BUCKET;

  // ======= Derived options from data =======
  const categories = useMemo(() => {
    const s = new Set();
    catalog.forEach((c) => c.categoria && s.add(c.categoria));
    return ["Todos", ...Array.from(s).sort((a, b) => a.localeCompare(b, "es"))];
  }, [catalog]);

  const severities = useMemo(() => {
    // Definimos la lista base (se puede actualizar si la BD contiene más)
    return ["Todos", "Desconocida", "leve", "moderado", "severo"]; 
  }, []);

  const crops = useMemo(() => {
    const s = new Set();
    catalog.forEach((c) => c.cultivo && s.add(c.cultivo));
    return ["Todos", ...Array.from(s).sort((a, b) => a.localeCompare(b, "es"))];
  }, [catalog]);

  const classes = useMemo(() => {
    const s = new Set();
    // Usamos taxonomia?.clase, ya que el hook está generando un objeto taxonomia
    catalog.forEach((c) => c.taxonomia?.clase && c.taxonomia.clase !== 'N/D' && s.add(c.taxonomia.clase));
    return ["Todos", ...Array.from(s).sort((a, b) => a.localeCompare(b, "es"))];
  }, [catalog]);

  // ======= Filtered + Sorted data =======
  const filtered = useMemo(() => {
    const q = normalize(query);
    return catalog.filter((it) => {
      const byQ =
        !q ||
        normalize(it.name).includes(q) ||
        normalize(it.nombre_comun).includes(q) ||
        normalize(it.nombre_cientifico).includes(q) ||
        normalize(it.sintomas_clave).includes(q);

      const byCat =
        catFilter === "Todos" ||
        normalize(it.categoria) === normalize(catFilter);

      const bySev =
        sevFilter === "Todos" ||
        normalize(it.severidad) === normalize(sevFilter);

      const byCrop =
        cropFilter === "Todos" ||
        normalize(it.cultivo) === normalize(cropFilter);

      const byClass =
        classFilter === "Todos" ||
        normalize(it.taxonomia?.clase) === normalize(classFilter);

      return byQ && byCat && bySev && byCrop && byClass;
    });
  }, [catalog, query, catFilter, sevFilter, cropFilter, classFilter, classes]);

  // ======= Pagination =======
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginated = filtered.slice(pageStart, pageEnd);

  // Reset page when filters or page size change
  useEffect(() => {
    setPage(1);
  }, [query, catFilter, sevFilter, cropFilter, classFilter, pageSize]);

  // ======= Signed URL fetchers (cached) =======
  const getThumbUrl = useCallback(
    async (path) => {
      if (!path) return null;
      if (thumbCache[path]) return thumbCache[path];
      const url = await createSigned(path, bucket);
      if (url) {
        setThumbCache((prev) => ({ ...prev, [path]: url }));
      }
      return url;
    },
    [thumbCache, bucket]
  );

  const getCarouselUrls = useCallback(
    async (paths) => {
      if (!paths || paths.length === 0) return [];
      const limited = paths.slice(0, 5);
      const results = await Promise.all(
        limited.map(async (p) => {
          if (carouselCache[p]) return carouselCache[p];
          const url = await createSigned(p, bucket);
          if (url) {
            setCarouselCache((prev) => ({ ...prev, [p]: url }));
          }
          return url;
        })
      );
      return results.filter(Boolean);
    },
    [carouselCache, bucket]
  );

  // ======= Prefetch thumbs for current page =======
  useEffect(() => {
    let active = true;
    const run = async () => {
      for (const item of paginated) {
        const first = item.images && item.images[0];
        if (first && !thumbCache[first]) {
          const url = await createSigned(first, bucket);
          if (active && url) {
            setThumbCache((prev) => ({ ...prev, [first]: url }));
          }
        }
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [paginated, bucket, getThumbUrl]); // Dependencia de getThumbUrl es correcta aquí

  const openModal = async (item) => {
    setSelected(item);
    setCarouselIndex(0);
    setActiveTab('detalles'); // Resetear a la primera pestaña al abrir
    // Prefetch carousel URLs
    await getCarouselUrls(item.images || []);
  };

  const closeModal = () => {
    setSelected(null);
    setCarouselIndex(0);
    // Limpiar el estado de las URLs del carrusel para prevenir CLS al reabrir
    setCarouselUrls([]); 
  };

  // Current carousel signed URL list
  const [carouselUrls, setCarouselUrls] = useState([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (selected?.images?.length) {
        // Usar getCarouselUrls para manejar la carga y el cacheo
        const urls = await getCarouselUrls(selected.images);
        if (active) setCarouselUrls(urls);
      } else {
        if (active) setCarouselUrls([]);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selected, getCarouselUrls]);

  const nextImage = () => {
    if (carouselUrls.length > 0) {
      setCarouselIndex((i) => (i + 1) % carouselUrls.length);
    }
  };
  const prevImage = () => {
    if (carouselUrls.length > 0) {
      setCarouselIndex((i) => (i - 1 + carouselUrls.length) % carouselUrls.length);
    }
  };


  // --- Renderización del contenido de las pestañas ---

  const renderTaxonomy = (tax) => (
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
        <h4 className="font-bold text-emerald-800 flex items-center gap-2">
            <Dna className="w-5 h-5 text-cyan-500"/>
            Clasificación Taxonómica
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
            {Object.entries(tax).map(([key, value]) => (
                <p key={key} className="truncate">
                    <span className="font-semibold capitalize text-emerald-600">
                        {key}:
                    </span>{' '}
                    {value || 'N/D'}
                </p>
            ))}
        </div>
    </div>
  );

  const renderSymptoms = (sintomas) => (
    <div className="space-y-4">
        <h4 className="font-semibold text-emerald-800 border-b pb-2 mb-2">
            Síntomas Clave: 
            <span className="font-normal text-sm text-gray-600 ml-2">
                {selected.organo_afectado || 'Varios órganos'}
            </span>
        </h4>
        {sintomas.length > 0 ? (
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
                {sintomas.map((s, i) => (
                    <li key={i}>
                        {s.descripcion} 
                        {s.organo && s.organo !== 'N/D' && (
                            <span className="text-xs italic text-gray-500 ml-2">({s.organo})</span>
                        )}
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-gray-500 italic">No hay información detallada de síntomas disponible.</p>
        )}
    </div>
  );

  const renderControls = ({ chemical, natural }) => (
    <div className="grid md:grid-cols-2 gap-6">
        <div>
            <h4 className="font-bold text-red-700 mb-2 border-b pb-1 flex items-center gap-1">
                <FlaskConical className="w-4 h-4"/> Tratamientos Químicos
            </h4>
            {chemical.length > 0 ? (
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    {chemical.map((t, i) => (
                        <li key={i} className="font-medium">
                            <span className="text-xs font-semibold text-gray-500 mr-1">[{t.tipo}]</span>
                            {t.descripcion}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-sm">No se especifican tratamientos químicos.</p>
            )}
        </div>
        <div>
            <h4 className="font-bold text-emerald-700 mb-2 border-b pb-1 flex items-center gap-1">
                <Bean className="w-4 h-4"/> Controles Naturales/Culturales
            </h4>
            {natural.length > 0 ? (
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    {natural.map((t, i) => (
                        <li key={i}>
                            <span className="font-medium text-emerald-600 capitalize text-xs mr-1">[{t.tipo}]</span> 
                            {t.descripcion}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-sm">No se especifican métodos de control natural.</p>
            )}
        </div>
    </div>
  );

  const renderReferences = (refs) => (
    <div className="space-y-4">
        <h4 className="font-semibold text-emerald-800 border-b pb-2 mb-2">Fuentes Documentales</h4>
        {refs.length > 0 ? (
            refs.map((ref, i) => (
                <div key={i} className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm">
                    <p className="font-semibold text-emerald-800 text-sm mb-1">
                        {ref.titulo_publicacion || ref.nombre_fuente || 'Referencia sin título'}
                    </p>
                    <p className="text-xs text-gray-600 italic">
                        {ref.autores || 'Autor Desconocido'} ({ref.año_publicacion || 'N/A'})
                    </p>
                    {ref.url_referencia && (
                        <a 
                            href={ref.url_referencia} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-cyan-600 text-xs hover:underline mt-1 inline-block"
                        >
                            Ver fuente <BookOpen className="w-3 h-3 inline-block ml-1"/>
                        </a>
                    )}
                </div>
            ))
        ) : (
            <p className="text-gray-500 italic">No hay referencias documentales disponibles.</p>
        )}
    </div>
  );
  
  // --- Render del Catálogo ---

  return (
    <motion.div
      className="bg-gradient-to-br from-emerald-50 via-cyan-50 to-sky-50 p-6 md:p-8 rounded-3xl shadow-xl border border-emerald-200 max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-emerald-800 flex items-center gap-2">
          <Bean className="w-7 h-7 text-cyan-500" />
          Catálogo de Amenazas PhytoScan IA
        </h2>

        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-emerald-800">Por página:</span>
          <select
            className="border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-gray-600 mb-4 text-sm">
        Catálogo técnico de referencia de enfermedades y plagas del **Frijol**. Funcionalidad **Offline-First**.
      </p>

      {/* Filters */}
      <div className="bg-white/70 rounded-2xl border border-emerald-200 p-3 md:p-4 mb-5 shadow-soft">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
            <input
              className="pl-9 w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
              placeholder="Buscar por nombre, científico o síntoma"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Categoría Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-600" />
            <select
              className="flex-1 border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Severidad Filter */}
          <div>
            <select
              className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
            >
              {severities.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Cultivo Filter (Asumimos Frijol) */}
          <div>
            <select
              className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
            >
              {crops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Clase Filter (Taxonomía) */}
          <div>
            <select
              className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results summary */}
        <div className="mt-3 text-sm text-emerald-800">
          Mostrando <b>{filtered.length === 0 ? 0 : pageStart + 1}</b>–<b>{Math.min(pageEnd, filtered.length)}</b> de <b>{filtered.length}</b> resultados
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex justify-center items-center py-10 text-emerald-700">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando catálogo...
        </div>
      )}
      {error && (
        <div className="flex justify-center items-center py-10 text-red-600">
          <AlertTriangle className="w-6 h-6 mr-2" />
          <span className="max-w-md text-center">
            {error}
          </span>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && (
        <>
          {paginated.length === 0 ? (
            <div className="text-center text-emerald-800 py-10">
              No se encontraron resultados con los filtros actuales.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {paginated.map((item) => {
                const first = item.images && item.images[0];
                const thumbUrl = first ? thumbCache[first] : null;
                return (
                  <motion.div
                    key={item.id}
                    className="bg-white border border-emerald-200 rounded-2xl shadow hover:shadow-lg transition cursor-pointer overflow-hidden"
                    whileHover={{ scale: 1.03 }}
                    onClick={() => openModal(item)}
                  >
                    {/* Tarjeta de imagen con fallback y manejo de errores */}
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={item.nombre_comun || item.name}
                        className="w-full h-40 object-cover rounded-t-2xl"
                        draggable={false}
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = `https://placehold.co/400x160/10B981/ffffff?text=Fallo+al+cargar+imagen`;
                        }}
                      />
                    ) : (
                      <div className="w-full h-40 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-t-2xl text-emerald-600 p-4 text-center">
                        <Bean className="w-10 h-10 mb-1" />
                        <span className="text-xs font-medium">Sin imagen de referencia</span>
                      </div>
                    )}

                    <div className="p-4">
                      <h3 className="font-semibold text-emerald-800 truncate">
                        {item.nombre_comun || item.name || "Sin nombre común"}
                      </h3>
                      <p className="text-sm italic text-gray-600 mb-2 truncate">
                        {item.nombre_cientifico || "Sin nombre científico"}
                      </p>
                      <div className="mt-2 text-xs flex flex-wrap items-center gap-2">
                        <span className="px-2 py-1 bg-gradient-to-r from-emerald-100 to-cyan-100 rounded-lg text-emerald-700 border border-emerald-200">
                          {item.categoria || "Categoría"}
                        </span>
                        {item.severidad && (
                          <span
                            className={classNames(
                              "px-2 py-1 rounded-lg border flex items-center gap-1",
                              sevColor(item.severidad)
                            )}
                          >
                            <Thermometer className="w-3 h-3"/>
                            {item.severidad}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Paginación */}
          <div className="flex justify-center items-center gap-3 mt-6">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-emerald-800 font-semibold">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 transition"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden relative max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold truncate">
                {selected.nombre_comun || selected.name}
              </h3>
              <button onClick={closeModal} className="text-white hover:text-gray-200 ml-4 p-1 rounded-full hover:bg-white/10 transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Carrusel / Contenido Desplazable */}
            <div className="overflow-y-auto flex-grow">
                {/* Carrusel */}
                {carouselUrls.length > 0 && (
                <div className="relative bg-gray-50 mb-4 h-72">
                    <img
                    src={carouselUrls[carouselIndex]}
                    alt="Imagen de referencia de la amenaza"
                    className="w-full h-72 object-cover"
                    draggable={false}
                    />
                    {carouselUrls.length > 1 && (
                    <>
                        <button
                        onClick={prevImage}
                        className="absolute top-1/2 left-4 -translate-y-1/2 bg-emerald-600/80 hover:bg-emerald-700 text-white p-2 rounded-full transition shadow-md"
                        >
                        <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                        onClick={nextImage}
                        className="absolute top-1/2 right-4 -translate-y-1/2 bg-emerald-600/80 hover:bg-emerald-700 text-white p-2 rounded-full transition shadow-md"
                        >
                        <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                            {carouselUrls.map((_, index) => (
                                <span
                                    key={index}
                                    className={classNames(
                                        "block w-2 h-2 rounded-full",
                                        index === carouselIndex ? "bg-white shadow-md" : "bg-white/50"
                                    )}
                                />
                            ))}
                        </div>
                    </>
                    )}
                </div>
                )}
                {carouselUrls.length === 0 && (
                    <div className="w-full h-72 flex flex-col items-center justify-center bg-gray-100/50 text-gray-500">
                        <AlertTriangle className="w-8 h-8 mb-2" />
                        <span className="text-sm">No hay imágenes disponibles para esta amenaza.</span>
                    </div>
                )}


                {/* Navegación por Pestañas */}
                <div className="flex flex-wrap gap-2 px-6 pb-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <TabButton 
                        isActive={activeTab === 'detalles'} 
                        icon={Info} 
                        onClick={() => setActiveTab('detalles')}
                    >
                        Detalles
                    </TabButton>
                    <TabButton 
                        isActive={activeTab === 'sintomas'} 
                        icon={Droplets} 
                        onClick={() => setActiveTab('sintomas')}
                    >
                        Síntomas
                    </TabButton>
                    <TabButton 
                        isActive={activeTab === 'controles'} 
                        icon={FlaskConical} 
                        onClick={() => setActiveTab('controles')}
                    >
                        Controles
                    </TabButton>
                    <TabButton 
                        isActive={activeTab === 'referencias'} 
                        icon={BookOpen} 
                        onClick={() => setActiveTab('referencias')}
                    >
                        Referencias
                    </TabButton>
                </div>


                {/* Contenido de las Pestañas */}
                <div className="p-6">
                    {/* Pestaña: Detalles */}
                    {activeTab === 'detalles' && (
                        <div className="space-y-6">
                            {renderTaxonomy(selected.taxonomia)}

                            <div>
                                <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-cyan-500"/>
                                    Información General
                                </h4>
                                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                                    <p><span className="font-semibold text-emerald-700">Científico:</span> {selected.nombre_cientifico || 'N/D'}</p>
                                    <p><span className="font-semibold text-emerald-700">Categoría:</span> {selected.categoria || 'N/D'}</p>
                                    <p><span className="font-semibold text-emerald-700">Clase:</span> {selected.taxonomia.clase || 'N/D'}</p>
                                    <p><span className="font-semibold text-emerald-700">Impacto Económico:</span> {selected.impacto_economico || 'N/D'}</p>
                                    <p className="md:col-span-2"><span className="font-semibold text-emerald-700">Distribución Global:</span> {selected.distribucion_global || 'N/D'}</p>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                    <Droplets className="w-5 h-5 text-cyan-500"/>
                                    Descripción General
                                </h4>
                                <p className="text-gray-700 whitespace-pre-line">{selected.descripcion_general || 'No hay descripción disponible.'}</p>
                            </div>
                        </div>
                    )}

                    {/* Pestaña: Síntomas */}
                    {activeTab === 'sintomas' && renderSymptoms(selected.sintomas_detalle)}

                    {/* Pestaña: Controles */}
                    {activeTab === 'controles' && renderControls({ 
                        chemical: selected.treatments_chemical, 
                        natural: selected.treatments_natural 
                    })}

                    {/* Pestaña: Referencias */}
                    {activeTab === 'referencias' && renderReferences(selected.referencias)}
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default OfflineCatalog;
