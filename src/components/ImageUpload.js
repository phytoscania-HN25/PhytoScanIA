import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, UploadCloud, XCircle, CheckCircle2, AlertTriangle,
  MapPin, CameraIcon, Leaf, FlaskConical, Info, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ===================== Config =====================
const BUCKET = process.env.REACT_APP_BUCKET || 'diagnostics';
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.REACT_APP_GEMINI_MODEL || 'gemini-1.5-flash';

// ===================== Utils =====================
const fileToBase64Content = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const res = r.result;
      if (typeof res === 'string' && res.startsWith('data:')) {
        return resolve(res.split(',')[1]);
      }
      resolve(res);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const safeJsonParse = (text) => {
  try {
    const cleaned = String(text).trim().replace(/^[`]+|[`]+$/g, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
    return JSON.parse(slice);
  } catch {
    return null;
  }
};

const uuid = () =>
  ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

const ymdPath = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${day}`;
};

const computeTrustScore = ({ route, hasGps }) => {
  if (route === 'test') return 0.10;
  if (route === 'field') return hasGps ? 0.95 : 0.65;
  return hasGps ? 0.45 : 0.25; // home
};

// ===================== Modal: Modo (Online / Offline) =====================
function ModeDialog({ open, onClose, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-emerald-900">¿Cómo deseas diagnosticar?</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-emerald-50">
            <XCircle className="w-5 h-5 text-emerald-800" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <button
            onClick={() => onSelect('online')}
            className="rounded-2xl border border-emerald-200 hover:border-emerald-400 p-4 text-left bg-emerald-50/40"
          >
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <UploadCloud className="w-4 h-4" /> Online
            </div>
            <p className="mt-1 text-emerald-900/80">
              Usa el motor en la nube de <b>PhytoScan IA</b>. Con tu consentimiento puede guardar imagen/ubicación.
            </p>
          </button>

          <button
            onClick={() => onSelect('offline')}
            className="rounded-2xl border border-lime-200 hover:border-lime-400 p-4 text-left bg-lime-50/40"
          >
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <CameraIcon className="w-4 h-4" /> Offline
            </div>
            <p className="mt-1 text-emerald-900/80">
              Usa tu modelo local de <b>PhytoScan IA</b>. No sube ni guarda datos.
            </p>
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-emerald-300">Cancelar</button>
        </div>
      </motion.div>
    </div>
  );
}

// ===================== Modal: Consentimiento =====================
function ConsentDialog({ open, onClose, onConfirm, defaultMode }) {
  // rutas: field | home | test
  const [route, setRoute] = useState(defaultMode === 'camera' ? 'field' : 'home');
  const [saveLocation, setSaveLocation] = useState(route === 'field');
  const [saveImage, setSaveImage] = useState(route !== 'test');

  useEffect(() => {
    const r = defaultMode === 'camera' ? 'field' : 'home';
    setRoute(r);
    setSaveLocation(r === 'field');
    setSaveImage(r !== 'test');
  }, [defaultMode]);

  useEffect(() => {
    if (route === 'test') {
      setSaveLocation(false);
      setSaveImage(false);
    } else if (route === 'field') {
      setSaveLocation(true);
      setSaveImage(true);
    }
  }, [route]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-emerald-900">Preferencias del diagnóstico</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-emerald-50">
            <XCircle className="w-5 h-5 text-emerald-800" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-emerald-900">
          <div>
            <p className="font-medium mb-1">¿Dónde haces este diagnóstico?</p>
            <div className="flex gap-2 flex-wrap">
              <button
                className={`px-3 py-1 rounded-lg border ${route==='field'?'bg-emerald-600 text-white border-emerald-600':'border-emerald-300'}`}
                onClick={() => setRoute('field')}
              >
                En el campo
              </button>
              <button
                className={`px-3 py-1 rounded-lg border ${route==='home'?'bg-emerald-600 text-white border-emerald-600':'border-emerald-300'}`}
                onClick={() => setRoute('home')}
              >
                En casa
              </button>
              <button
                className={`px-3 py-1 rounded-lg border ${route==='test'?'bg-emerald-600 text-white border-emerald-600':'border-emerald-300'}`}
                onClick={() => setRoute('test')}
              >
                Prueba
              </button>
            </div>
          </div>

          {route !== 'test' && (
            <>
              <div className="flex items-center gap-2">
                <input id="save-image" type="checkbox" checked={saveImage} onChange={e=>setSaveImage(e.target.checked)} />
                <label htmlFor="save-image">Guardar imagen en Storage</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="save-location" type="checkbox" checked={saveLocation} onChange={e=>setSaveLocation(e.target.checked)} />
                <label htmlFor="save-location">Guardar mi ubicación (si está disponible)</label>
              </div>
            </>
          )}

          {route === 'test' && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <Info className="w-4 h-4" />
              En modo <b>prueba</b> no se guardará <b>imagen</b> ni <b>ubicación</b>, solo verás el resultado.
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-emerald-300">Cancelar</button>
          <button onClick={()=> onConfirm({ route, saveLocation, saveImage })} className="px-3 py-2 rounded-lg bg-emerald-600 text-white">
            Continuar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ===================== Modal: Resultado =====================
function ResultModal({ open, onClose, result, meta }) {
  const [showDetails, setShowDetails] = React.useState(false);
  if (!open || !result) return null;

  const { type, name, confidence, stage, recommendation, treatment } = result;
  const {
    savedAt, user, imageUrl, imagePath, location,
    route, trust, clientId, localPreview
  } = meta || {};

  const displayUrl = imageUrl || localPreview;

  const tone =
    type === 'Saludable' ? 'green' :
    (type === 'Plaga' || type === 'Enfermedad') ? 'red' : 'gray';

  const toneClasses = {
    green: { ring: 'ring-green-200/60', badgeBg: 'bg-green-100 text-green-800 border-green-200', panelBg: 'bg-green-50/60 border-green-200', icon: 'text-green-600' },
    red:   { ring: 'ring-red-200/60',   badgeBg: 'bg-red-100 text-red-800 border-red-200',     panelBg: 'bg-red-50/60 border-red-200',     icon: 'text-red-600' },
    gray:  { ring: 'ring-gray-200/60',  badgeBg: 'bg-gray-100 text-gray-800 border-gray-200',  panelBg: 'bg-gray-50/60 border-gray-200',   icon: 'text-gray-600' }
  }[tone];

  const conf = typeof confidence === 'number' ? Math.round(confidence * 100) : null;
  const routeLabel = route === 'field' ? 'Campo' : route === 'home' ? 'Casa' : route === 'test' ? 'Prueba' : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-2xl rounded-3xl bg-white/90 backdrop-blur shadow-2xl ring-1 ring-emerald-200/50"
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            {type === 'Saludable' && <CheckCircle2 className={`w-6 h-6 ${toneClasses.icon}`} />}
            {(type === 'Plaga' || type === 'Enfermedad') && <AlertTriangle className={`w-6 h-6 ${toneClasses.icon}`} />}
            {type === 'Indeterminado' && <XCircle className={`w-6 h-6 ${toneClasses.icon}`} />}
            <h3 className="text-lg md:text-xl font-semibold text-emerald-900">Resultado del diagnóstico</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-emerald-50 transition" aria-label="Cerrar">
            <XCircle className="w-5 h-5 text-emerald-800" />
          </button>
        </div>

        {/* body */}
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-[140px,1fr] gap-4">
            {/* image */}
            <div className="flex md:block items-center justify-center">
              <div className={`relative w-36 h-36 rounded-2xl overflow-hidden ring-2 ${toneClasses.ring}`}>
                {displayUrl ? (
                  <img src={displayUrl} alt="Imagen del diagnóstico" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-500 text-xs">
                    Sin imagen
                  </div>
                )}
                <div className="absolute -top-1 -left-1 w-10 h-10 bg-gradient-to-br from-emerald-200/60 to-lime-200/40 rounded-br-3xl pointer-events-none" />
              </div>
            </div>

            {/* info */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs ${toneClasses.badgeBg}`}>{type}</span>
                {routeLabel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                    {routeLabel}
                  </span>
                )}
                {typeof trust === 'number' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs bg-lime-100 text-lime-800 border-lime-200">
                    Trust {trust.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
                <h4 className="text-xl md:text-2xl font-bold text-emerald-900 tracking-tight">{name}</h4>
                <div className="text-xs sm:text-sm text-emerald-700/80">
                  Etapa: <span className="font-semibold">{stage || 'N/A'}</span>
                </div>
              </div>

              {/* confianza */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-900/70">
                  <span>Confianza del modelo</span>
                  <span className="font-semibold">{conf !== null ? `${conf}%` : 'N/A'}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-lime-500" style={{ width: `${conf ?? 0}%` }} />
                </div>
              </div>

              {/* recomendación */}
              <div className={`rounded-2xl p-4 border ${toneClasses.panelBg}`}>
                <div className="text-sm font-semibold text-emerald-900 mb-1">Recomendación</div>
                <p className="text-sm text-emerald-900/80">{recommendation}</p>
                {(treatment?.natural?.length || treatment?.chemical?.length) && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {treatment?.natural?.length > 0 && (
                      <div className="text-xs">
                        <div className="font-semibold flex items-center gap-1 text-emerald-900">
                          <Leaf className="w-3.5 h-3.5" /> Naturales
                        </div>
                        <ul className="mt-1 list-disc list-inside text-emerald-900/80">
                          {treatment.natural.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {treatment?.chemical?.length > 0 && (
                      <div className="text-xs">
                        <div className="font-semibold flex items-center gap-1 text-emerald-900">
                          <FlaskConical className="w-3.5 h-3.5" /> Químicos
                        </div>
                        <ul className="mt-1 list-disc list-inside text-emerald-900/80">
                          {treatment.chemical.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* detalles técnicos */}
              <div className="mt-1">
                <button
                  onClick={() => setShowDetails(v => !v)}
                  className="group inline-flex items-center gap-1 text-xs text-emerald-800/80 hover:text-emerald-900 transition"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  {showDetails ? 'Ocultar' : 'Ver'} detalles técnicos
                </button>

                {showDetails && (
                  <div className="mt-2 rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 text-[11px] text-emerald-900/90">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      <div><b>Modelo:</b> PhytoScan IA</div>
                      {savedAt && <div><b>Fecha:</b> {new Date(savedAt).toLocaleString()}</div>}
                      {user?.id && <div className="truncate"><b>Usuario:</b> {user.id}</div>}
                      {clientId && <div className="truncate"><b>Client ID:</b> {clientId}</div>}
                      {routeLabel && <div><b>Ruta:</b> {routeLabel}</div>}
                      <div><b>Persistencia imagen:</b> {imagePath ? 'Guardada' : 'No guardada'}</div>
                      {imagePath && <div className="truncate"><b>Bucket/Path:</b> {`${BUCKET} / ${imagePath}`}</div>}
                      {location?.latitude && (
                        <div className="sm:col-span-2">
                          <b>Coordenadas:</b> {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} {location.accuracy_m ? `(±${Math.round(location.accuracy_m)}m)` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-600 text-white shadow hover:opacity-95 transition">
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ===================== Componente principal =====================
export default function ImageUpload({ onImageSelect, onDiagnose }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState('');

  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Modalidad
  const [mode, setMode] = useState(null);          // 'online' | 'offline'
  const [modeOpen, setModeOpen] = useState(false); // Modal para elegir modo

  // Consentimiento (solo ONLINE)
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentMode, setConsentMode] = useState('upload');   // 'camera' | 'upload'
  const [route, setRoute] = useState('home');                  // 'field' | 'home' | 'test'
  const [locationConsent, setLocationConsent] = useState(false);
  const [storageConsent, setStorageConsent] = useState(false);

  // Modal de resultado
  const [resultOpen, setResultOpen] = useState(false);
  const [resultMeta, setResultMeta] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  // Geolocalización (solo si hay consentimiento y NO en prueba)
  useEffect(() => {
    if (!locationConsent || route === 'test') return;
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_m: position.coords.accuracy ?? null,
          });
          setGettingLocation(false);
        },
        () => {
          setDiagnosisError('No se pudo obtener la ubicación. Puedes continuar sin ella.');
          setGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setDiagnosisError('Tu navegador no soporta geolocalización.');
      setGettingLocation(false);
    }
  }, [locationConsent, route]);

  // Cámara
  useEffect(() => {
    if (isCameraActive) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        })
        .catch(() => {
          setDiagnosisError('No se pudo acceder a la cámara. Revisa permisos.');
          setIsCameraActive(false);
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }
  }, [isCameraActive]);

  // -------------------- OFFLINE (stub) --------------------
  const diagnoseWithOffline = async (file) => {
    try {
      // Conecta aquí tu modelo local:
      // const bitmap = await createImageBitmap(file);
      // const pred = await window.PhytoScanIA?.predict(bitmap);
      // return { type, name, confidence, stage, recommendation, treatment, raw: pred }

      // Placeholder: muestra mensaje hasta integrar el modelo
      return {
        type: 'Indeterminado',
        name: 'Motor offline no conectado',
        confidence: 0,
        stage: 'N/A',
        recommendation: 'Carga el modelo offline y vuelve a intentar.',
        treatment: { natural: [], chemical: [] },
        raw: null
      };
    } catch (e) {
      return {
        type: 'Indeterminado',
        name: 'Error en motor offline',
        confidence: 0,
        stage: 'N/A',
        recommendation: 'Revisa el cargador del modelo o el formato de la imagen.',
        treatment: { natural: [], chemical: [] },
        raw: null
      };
    }
  };

  // -------------------- ONLINE (motor en la nube) --------------------
  const diagnoseWithCloud = async (file) => {
    if (!GEMINI_API_KEY) throw new Error('Falta REACT_APP_GEMINI_API_KEY en .env.local');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const systemPrompt = `
Eres un fitopatólogo experto en frijol. Devuelve SOLO JSON:
{
  "type": "Plaga" | "Enfermedad" | "Saludable" | "Indeterminado",
  "name": "string",
  "confidence": 0..1,
  "stage": "string",
  "recommendation": "string",
  "treatment": { "natural": [string], "chemical": [string] }
}
Sin texto adicional.
    `.trim();

    const base64 = await fileToBase64Content(file);
    const mime = file.type || 'image/png';

    const result = await model.generateContent([
      { text: systemPrompt },
      { inlineData: { data: base64, mimeType: mime } },
    ]);

    const text = (await result.response.text()) || '';
    const parsed = safeJsonParse(text);
    if (!parsed) throw new Error('No se pudo interpretar la respuesta del motor en la nube');

    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : null;

    return {
      type: parsed.type || 'Indeterminado',
      name: parsed.name || 'Desconocido',
      confidence,
      stage: parsed.stage || 'N/A',
      recommendation: parsed.recommendation || '—',
      treatment: {
        natural: Array.isArray(parsed?.treatment?.natural) ? parsed.treatment.natural : [],
        chemical: Array.isArray(parsed?.treatment?.chemical) ? parsed.treatment.chemical : [],
      },
      raw: parsed
    };
  };

  // Supabase upload (condicional)
  const uploadImageToSupabase = async (file, userId) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const id = uuid();
    const path = `${ymdPath()}/${userId || 'anon'}/${id}.${ext}`;

    setUploadingImage(true);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });
    setUploadingImage(false);

    if (error) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('bucket')) {
        setDiagnosisError(`No se pudo subir al bucket "${BUCKET}". Verifica que exista y que tengas permiso de 'upload'.`);
      } else if (msg.includes('duplicate') || msg.includes('already exists')) {
        setDiagnosisError('Conflicto de nombre de archivo. Intenta de nuevo.');
      } else {
        setDiagnosisError('Error al subir la imagen. Revisa el bucket y permisos.');
      }
      return null;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: pub?.publicUrl || null, path };
  };

  // Guardar reporte
  const saveReportToSupabase = async (payload) => {
    const { error } = await supabase.from('reports').insert([payload]);
    if (error) {
      setDiagnosisError('Error al guardar el reporte.');
      return false;
    }
    return true;
  };

  // --- Handlers imagen ---
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const r = new FileReader();
    r.onloadend = () => {
      setImagePreview(r.result);
      onImageSelect && onImageSelect(file);
    };
    r.readAsDataURL(file);
    setDiagnosisResult(null);
    setDiagnosisError('');
    setIsCameraActive(false);

    setConsentMode('upload');
    setModeOpen(true); // Primero elegimos Online/Offline
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImageFile(file);
    const r = new FileReader();
    r.onloadend = () => {
      setImagePreview(r.result);
      onImageSelect && onImageSelect(file);
    };
    r.readAsDataURL(file);
    setDiagnosisResult(null);
    setDiagnosisError('');
    setIsCameraActive(false);

    setConsentMode('upload');
    setModeOpen(true);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setDiagnosisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onImageSelect && onImageSelect(null);
    setIsCameraActive(false);
  };

  const handleUploadButtonClick = () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      fileInputRef.current?.click();
    }
  };

  const takePhoto = () => {
    if (!(videoRef.current && canvasRef.current)) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const capturedFile = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });
      setImageFile(capturedFile);
      setImagePreview(URL.createObjectURL(capturedFile));
      setDiagnosisResult(null);
      setDiagnosisError('');
      setIsCameraActive(false);

      setConsentMode('camera');
      setModeOpen(true); // Primero elegimos Online/Offline
    }, 'image/png');
  };

  // --- Diagnóstico principal ---
  const handleDiagnose = async () => {
    try {
      if (!imageFile) return setDiagnosisError('Sube o toma una imagen.');
      if (!mode) {
        setModeOpen(true); // si no eligió modo, preguntar ahora
        return;
      }

      setLoadingDiagnosis(true);
      setDiagnosisError('');

      // ---------------- OFFLINE ----------------
      if (mode === 'offline') {
        const off = await diagnoseWithOffline(imageFile);
        setDiagnosisResult(off);
        setResultMeta({
          savedAt: null,
          user: currentUser ? { id: currentUser.id } : null,
          imageUrl: null,
          imagePath: null,
          location: null,
          route: null,
          trust: null,
          clientId: null,
          localPreview: imagePreview
        });
        setResultOpen(true);
        onDiagnose && onDiagnose(off);
        return;
      }

      // ---------------- ONLINE ----------------
      if (!currentUser) return setDiagnosisError('Debes iniciar sesión para el modo Online.');

      // 1) Diagnóstico con motor en la nube (PhytoScan IA)
      const cloud = await diagnoseWithCloud(imageFile);
      setDiagnosisResult({ ...cloud, confidence: typeof cloud.confidence === 'number' ? cloud.confidence : null });

      // 2) Persistencia según ruta/consentimientos
      const hasGps = !!(locationConsent && userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude));
      const trust_score = computeTrustScore({ route, hasGps });

      // 3) PRUEBA: no guardar
      if (route === 'test') {
        setResultMeta({
          savedAt: null,
          user: { id: currentUser.id },
          imageUrl: null,
          imagePath: null,
          location: null,
          route,
          trust: trust_score,
          clientId: null,
          localPreview: imagePreview
        });
        setResultOpen(true);
        return;
      }

      // 4) CASA / CAMPO: subir imagen si hay consentimiento
      let uploaded = null;
      if (storageConsent) {
        uploaded = await uploadImageToSupabase(imageFile, currentUser.id);
        if (!uploaded) { setLoadingDiagnosis(false); return; }
      }

      // 5) Guardar reporte
      const clientId = uuid();
      const payload = {
        client_id: clientId,
        user_id: currentUser.id,
        cultivo: 'frijol',
        is_field: route === 'field',
        is_testing: false,
        trust_score,
        location_source: hasGps ? 'device_gps' : 'none',
        latitude: hasGps ? userLocation.latitude : null,
        longitude: hasGps ? userLocation.longitude : null,
        accuracy_m: hasGps ? (userLocation.accuracy_m ?? null) : null,
        location_consent: !!locationConsent,

        diagnosis_label: cloud.name,
        diagnosis_score: cloud.confidence ?? null,
        alt_predictions: cloud.raw?.alternatives ?? null,

        image_bucket: uploaded ? BUCKET : null,
        image_path: uploaded ? uploaded.path : null,
        image_url: uploaded ? uploaded.publicUrl : null,

        notes: null,
        device_info: { ua: navigator.userAgent }
      };

      const ok = await saveReportToSupabase(payload);
      if (!ok) { setLoadingDiagnosis(false); return; }

      setResultMeta({
        savedAt: new Date().toISOString(),
        user: { id: currentUser.id },
        imageUrl: uploaded?.publicUrl || null,
        imagePath: uploaded?.path || null,
        location: hasGps ? userLocation : null,
        route,
        trust: trust_score,
        clientId,
        localPreview: imagePreview
      });
      setResultOpen(true);
      onDiagnose && onDiagnose(cloud);
    } catch (err) {
      setDiagnosisError(err?.message || 'Error durante el diagnóstico.');
    } finally {
      setLoadingDiagnosis(false);
    }
  };

  // --- UI ---
  const canDiagnose =
    !!imageFile &&
    !loadingDiagnosis &&
    !uploadingImage &&
    (mode === 'offline' || (mode === 'online' ? !!currentUser : false));

  return (
    <motion.div
      className="card max-w-3xl mx-auto p-8"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {/* Encabezado agro-tech */}
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-lime-600 flex items-center justify-center gap-2">
        <Leaf className="w-8 h-8" />
        Diagnóstico inteligente de frijol
      </h2>
      <p className="mt-2 text-sm md:text-base text-emerald-900/80 text-center">
        Sube o captura una imagen para que (<span className="font-semibold">PhytoScan IA</span>) identifique la plaga o enfermedad.
        Selecciona: <em>campo</em>, <em>casa</em> o <em>prueba</em>.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">Offline-first</span>
        <span className="px-2.5 py-1 rounded-full text-xs bg-lime-100 text-lime-800 border border-lime-200">Ubicación opcional</span>
        <span className="px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-200">Modo prueba (no guarda)</span>
      </div>

      {/* Botones principales */}
      <div className="flex justify-center gap-4 mb-6 mt-6">
        <motion.button
          onClick={() => setIsCameraActive(true)}
          className="btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <CameraIcon size={20} /> Tomar Foto
        </motion.button>
        <motion.button
          onClick={handleUploadButtonClick}
          className="btn-secondary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <UploadCloud size={20} /> Subir Archivo
        </motion.button>
      </div>

      {/* Cámara */}
      {isCameraActive && (
        <motion.div className="relative w-full h-64 bg-gray-800 rounded-xl overflow-hidden mb-6">
          <video ref={videoRef} className="w-full h-full object-cover"></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          <motion.button
            onClick={takePhoto}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-white rounded-full shadow-lg border-2 border-primary-green"
          >
            <CameraIcon size={28} className="text-primary-green" />
          </motion.button>
          <motion.button
            onClick={() => setIsCameraActive(false)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1"
          >
            <XCircle size={24} />
          </motion.button>
        </motion.div>
      )}

      {/* Input oculto */}
      <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />

      {/* Drag & Drop */}
      {!isCameraActive && (
        <div
          className="relative group rounded-2xl border-2 border-dashed p-0.5 mb-6"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={handleUploadButtonClick}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-200/30 via-transparent to-lime-200/30 blur opacity-0 group-hover:opacity-100 transition" />
          <div className="relative rounded-[1rem] p-6 bg-white/70 backdrop-blur border border-emerald-200/60">
            {imagePreview ? (
              <div className="relative w-full h-64 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="max-h-full max-w-full object-contain rounded-xl shadow-md border border-emerald-200"
                />
                <motion.button
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                >
                  <XCircle size={24} />
                </motion.button>
              </div>
            ) : (
              <div className="grid md:grid-cols-[auto,1fr] gap-4 items-center">
                <div className="mx-auto w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-100 to-lime-100 border border-emerald-200 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-emerald-700" />
                </div>
                <div className="text-center md:text-left">
                  <h4 className="font-semibold text-emerald-900">Suelta tu foto aquí</h4>
                  <p className="text-emerald-900/70 text-sm">O <span className="underline">haz clic</span> para escoger desde tu dispositivo.</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-900/70">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2 py-1">
                      <CameraIcon className="w-3.5 h-3.5" /> Cámara
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2 py-1">
                      <UploadCloud className="w-3.5 h-3.5" /> Galería
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2 py-1">
                      <MapPin className="w-3.5 h-3.5" /> Ubicación (si aceptas)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botón Diagnosticar */}
      <motion.button
        onClick={handleDiagnose}
        disabled={!canDiagnose}
        className={`btn-primary w-full flex items-center justify-center gap-2 ${canDiagnose ? '' : 'opacity-60 cursor-not-allowed'}`}
      >
        {loadingDiagnosis || uploadingImage ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {uploadingImage ? 'Subiendo imagen...' : 'Diagnosticando...'}
          </>
        ) : (
          <>
            <Camera size={24} />
            Diagnosticar
          </>
        )}
      </motion.button>

      {/* Errores */}
      {diagnosisError && (
        <motion.p className="text-red-500 text-sm text-center mt-6">
          {diagnosisError}
        </motion.p>
      )}

      {/* Modal de modo */}
      <ModeDialog
        open={modeOpen}
        onClose={() => setModeOpen(false)}
        onSelect={(chosen) => {
          setMode(chosen); // 'online' | 'offline'
          setModeOpen(false);
          if (chosen === 'online') {
            setConsentOpen(true); // luego se elige Campo/Casa/Prueba y consentimientos
          }
        }}
      />

      {/* Modal de consentimiento (solo ONLINE) */}
      <ConsentDialog
        open={consentOpen}
        defaultMode={consentMode}
        onClose={() => setConsentOpen(false)}
        onConfirm={({ route, saveLocation, saveImage }) => {
          setRoute(route);
          setLocationConsent(!!saveLocation);
          setStorageConsent(!!saveImage);
          setConsentOpen(false);
        }}
      />

      {/* Canvas oculto */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Modal de resultado */}
      <ResultModal
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        result={diagnosisResult}
        meta={resultMeta}
      />
    </motion.div>
  );
}
