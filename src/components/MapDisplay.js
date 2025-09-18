
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Loader2, AlertTriangle, Search, Crosshair, Download, Globe } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat/dist/leaflet-heat.js';

// Fix default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const severityColors = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
const severityHex = { alta: 'ff0000', media: 'ff8c00', baja: '00a65a' };

const markerIcon = (severity) =>
  new L.Icon({
    iconUrl: `https://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|${severityHex[severity] || '3388ff'}`,
    iconSize: [21, 34], iconAnchor: [10, 34], popupAnchor: [1, -34],
  });

const normalize = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slugify = (s) => normalize(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

// Nicaragua full departments & autonomous regions
const NIC_DEPARTAMENTOS = [
  'Boaco','Carazo','Chinandega','Chontales','Estelí','Granada','Jinotega','León','Madriz','Managua','Masaya','Matagalpa','Nueva Segovia','Río San Juan','Rivas','RACCN','RACCS'
];

// Bounding boxes as fallback to filter by country when report has no country_code/name
const COUNTRY_BBOX = {
  'Nicaragua': { minLat: 10.7, maxLat: 15.1, minLon: -87.8, maxLon: -82.7 },
  'Honduras': { minLat: 12.9, maxLat: 16.5, minLon: -89.4, maxLon: -83.1 },
  'El Salvador': { minLat: 13.0, maxLat: 14.5, minLon: -90.2, maxLon: -87.7 },
  'Guatemala': { minLat: 13.7, maxLat: 18.5, minLon: -92.3, maxLon: -88.2 },
  'Costa Rica': { minLat: 8.0, maxLat: 11.4, minLon: -86.2, maxLon: -82.5 },
  'Panamá': { minLat: 7.1, maxLat: 9.7, minLon: -83.1, maxLon: -77.1 },
  'México': { minLat: 14.3, maxLat: 32.7, minLon: -118.5, maxLon: -86.5 },
  'Colombia': { minLat: -4.2, maxLat: 13.4, minLon: -79.0, maxLon: -66.8 },
};

// Dataset categories for Frijol (fallback if no taxonomy table found)
const CATEGORIES = ['abiotic','bacteria','fungi','insect','mite','nematode','virus','healthy'];

const MapDisplay = () => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const baseLayers = useRef({});
  const markersLayer = useRef(null);
  const clusterLayer = useRef(null);
  const heatLayer = useRef(null);
  const circlesLayer = useRef(null);
  const clusterTooltip = useRef(null);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [country, setCountry] = useState('Nicaragua'); // default
  const [queryDepto, setQueryDepto] = useState('');
  const [queryMuni, setQueryMuni] = useState('');
  const [queryCategory, setQueryCategory] = useState('');
  const [queryDiagnosis, setQueryDiagnosis] = useState('');
  const [querySeverity, setQuerySeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Toggles
  const [showMarkers, setShowMarkers] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showAlertCircles, setShowAlertCircles] = useState(true);
  const [heatmapOnly, setHeatmapOnly] = useState(false);

  // Taxonomy from DB (optional)
  const [taxonomy, setTaxonomy] = useState(null);

  // Parse params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCountry(params.get('country') || 'Nicaragua');
    setQueryDepto(params.get('depto') || '');
    setQueryMuni(params.get('muni') || '');
    setQueryCategory(params.get('cat') || '');
    setQueryDiagnosis(params.get('diag') || '');
    setQuerySeverity(params.get('sev') || '');
    setDateFrom(params.get('from') || '');
    setDateTo(params.get('to') || '');
    setShowMarkers(params.get('markers') !== '0');
    setShowClusters(params.get('clusters') !== '0');
    setShowHeatmap(params.get('heat') !== '0');
    setShowAlertCircles(params.get('circles') !== '0');
    setHeatmapOnly(params.get('heatOnly') === '1');
  }, []);

  // Persist params on change
  useEffect(() => {
    const params = new URLSearchParams();
    if (country) params.set('country', country);
    if (queryDepto) params.set('depto', queryDepto);
    if (queryMuni) params.set('muni', queryMuni);
    if (queryCategory) params.set('cat', queryCategory);
    if (queryDiagnosis) params.set('diag', queryDiagnosis);
    if (querySeverity) params.set('sev', querySeverity);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (!showMarkers) params.set('markers', '0');
    if (!showClusters) params.set('clusters', '0');
    if (!showHeatmap) params.set('heat', '0');
    if (!showAlertCircles) params.set('circles', '0');
    if (heatmapOnly) params.set('heatOnly', '1');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [country, queryDepto, queryMuni, queryCategory, queryDiagnosis, querySeverity, dateFrom, dateTo, showMarkers, showClusters, showHeatmap, showAlertCircles, heatmapOnly]);

  // Init map
  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, { zoomControl: true }).setView([12.8654, -85.2072], 7);
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(leafletMap.current);
      const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap & CARTO', maxZoom: 20 });
      const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });
      baseLayers.current = { 'OSM': osm, 'Carto Light': cartoLight, 'ESRI Satélite': esriSat };
      L.control.layers(baseLayers.current, {}, { position: 'topright' }).addTo(leafletMap.current);
      L.control.scale({ imperial: false }).addTo(leafletMap.current);
      markersLayer.current = L.layerGroup().addTo(leafletMap.current);
      clusterLayer.current = L.markerClusterGroup({ showCoverageOnHover: false, disableClusteringAtZoom: 15 });
      circlesLayer.current = L.layerGroup().addTo(leafletMap.current);
      heatLayer.current = null;
    }
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Fetch taxonomy (try multiple tables to adapt to your schema)
  useEffect(() => {
    const tryTables = async () => {
      const candidates = [
        { table: 'taxonomy', fields: 'cultivo, categoria, nombre_cientifico, nombre_comun, slug' },
        { table: 'plagas_enfermedades', fields: 'cultivo, categoria, nombre_cientifico, nombre_comun, slug' },
        { table: 'catalog_taxonomy', fields: 'cultivo, categoria, nombre_cientifico, nombre_comun, slug' },
        { table: 'plagas', fields: 'cultivo, categoria, nombre_cientifico, nombre_comun, slug' },
        { table: 'enfermedades', fields: 'cultivo, categoria, nombre_cientifico, nombre_comun, slug' },
      ];
      for (const c of candidates) {
        try {
          const { data, error } = await supabase.from(c.table).select(c.fields);
          if (!error && Array.isArray(data)) {
            setTaxonomy(data);
            return;
          }
        } catch (e) {}
      }
      setTaxonomy(null);
    };
    tryTables();
  }, []);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true); setError(null);
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id, latitude, longitude, diagnosis, created_at, image_url, localidad, municipio, departamento, severity, precision_level, alert_radius_km, country_code, country_name, category')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setReports(data || []);
      } catch (err) {
        console.error('Error al cargar reportes:', err);
        setError('No se pudieron cargar los reportes del mapa.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  
  // Fetch reports from new schema (Detecciones_Campo + joins) with graceful fallbacks
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true); setError(null);
      try {
        if (!supabase) throw new Error('Supabase no configurado');
        // 1) Core detections
        const { data: dets, error: eDet } = await supabase
          .from('Detecciones_Campo')
          .select('id_deteccion, latitud, longitud, fecha_hora_scan, id_amenaza_detectada, id_municipio, confianza_ia')
          .order('fecha_hora_scan', { ascending: false })
          .limit(5000);
        if (eDet) throw eDet;

        // 2) Lookup tables
        const [{ data: amz }, { data: mun }, { data: dep }, { data: pais }, { data: cat }] = await Promise.all([
          supabase.from('Amenazas').select('id_amenaza, nombre_comun, id_categoria'),
          supabase.from('Municipios').select('id_municipio, nombre_municipio, id_depto'),
          supabase.from('Departamentos').select('id_depto, nombre_depto, id_pais'),
          supabase.from('Paises').select('id_pais, nombre_pais, codigo_iso'),
          supabase.from('Categorias').select('id_categoria, nombre_categoria'),
        ]);

        const amzMap = Object.fromEntries((amz||[]).map(a=>[a.id_amenaza, a]));
        const munMap = Object.fromEntries((mun||[]).map(m=>[m.id_municipio, m]));
        const depMap = Object.fromEntries((dep||[]).map(d=>[d.id_depto, d]));
        const paisMap = Object.fromEntries((pais||[]).map(p=>[p.id_pais, p]));
        const catMap = Object.fromEntries((cat||[]).map(c=>[c.id_categoria, c]));

        const mapped = (dets||[]).map(d => {
          const a = amzMap[d.id_amenaza_detectada] || {};
          const m = munMap[d.id_municipio] || {};
          const dp = depMap[m.id_depto] || {};
          const p = paisMap[dp.id_pais] || {};
          const c = catMap[a.id_categoria] || {};
          // Simple severity from confianza_ia
          const sev = (d.confianza_ia>=0.8) ? 'Alta' : (d.confianza_ia>=0.5 ? 'Media' : 'Baja');
          return {
            id: d.id_deteccion,
            latitude: Number(d.latitud),
            longitude: Number(d.longitud),
            diagnosis: a.nombre_comun || 'Desconocido',
            created_at: d.fecha_hora_scan,
            departamento: dp.nombre_depto || '',
            municipio: m.nombre_municipio || '',
            severity: sev,
            country_name: p.nombre_pais || '',
            country_code: p.codigo_iso || null,
            category: c.nombre_categoria || '',
          };
        }).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

        if (!mapped.length) {
          // Fallback: try legacy view or table
          try {
            const { data, error } = await supabase
              .from('v_reports_map')
              .select('*')
              .order('observation_date', { ascending: true })
              .limit(5000);
            if (!error && data?.length) {
              setReports(data);
              setLoading(false);
              return;
            }
          } catch {}
          try {
            const { data, error } = await supabase
              .from('reports')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(5000);
            if (!error && data?.length) {
              setReports(data);
              setLoading(false);
              return;
            }
          } catch {}
        }

        setReports(mapped);
      } catch (err) {
        console.error('Error al cargar reportes:', err);
        setError('No se pudieron cargar los reportes del mapa.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);
// Filtered reports with country logic
  const filteredReports = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00Z').getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59Z').getTime() : Infinity;
    const countrySel = (country || '').trim();

    return (reports || []).filter(r => {
      const t = new Date(r.created_at).getTime();
      if (!(t >= fromTs && t <= toTs)) return false;

      // Country filter: if record has country_name/code, use it, else fallback to BBOX
      let matchCountry = true;
      if (countrySel && countrySel !== 'Todos') {
        const hasCol = (r.country_name || r.country_code);
        if (hasCol) {
          matchCountry = normalize(r.country_name || r.country_code).includes(normalize(countrySel)) || (countrySel === 'Nicaragua' && (r.country_code === 'NI'));
        } else {
          const box = COUNTRY_BBOX[countrySel];
          if (box && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
            matchCountry = r.latitude >= box.minLat && r.latitude <= box.maxLat && r.longitude >= box.minLon && r.longitude <= box.maxLon;
          }
        }
      }

      const matchDepto = queryDepto ? normalize(r.departamento).includes(normalize(queryDepto)) : true;
      const matchMuni = queryMuni ? normalize(r.municipio).includes(normalize(queryMuni)) : true;
      const matchCat = queryCategory ? normalize(r.category || '').includes(normalize(queryCategory)) : true;
      const matchDiag = queryDiagnosis ? normalize(r.diagnosis).includes(normalize(queryDiagnosis)) : true;
      const matchSev = querySeverity ? normalize(r.severity) === normalize(querySeverity) : true;
      return matchCountry && matchDepto && matchMuni && matchCat && matchDiag && matchSev;
    });
  }, [reports, country, queryDepto, queryMuni, queryCategory, queryDiagnosis, querySeverity, dateFrom, dateTo]);

  // Severity count
  const severityCount = useMemo(() => {
    const cnt = { alta: 0, media: 0, baja: 0 };
    filteredReports.forEach(r => { const k = (r.severity || '').toLowerCase(); if (cnt[k] !== undefined) cnt[k] += 1; });
    return cnt;
  }, [filteredReports]);

  // Render layers
  useEffect(() => {
    if (!leafletMap.current || loading || error) return;
    markersLayer.current.clearLayers();
    circlesLayer.current.clearLayers();
    clusterLayer.current.clearLayers();
    if (heatLayer.current) { leafletMap.current.removeLayer(heatLayer.current); heatLayer.current = null; }

    const leafletMarkers = [];
    const heatPoints = [];

    filteredReports.forEach(r => {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return;

      const popupContent = `
        <div style="font-family: Inter, system-ui, sans-serif; font-size: 14px; max-width: 260px;">
          <h3 style="font-weight: 700; margin-bottom: 6px;">${r.diagnosis || 'Diagnóstico'}</h3>
          ${r.image_url ? `<img src="${r.image_url}" alt="Reporte" style="width:100%; max-width:220px; height:auto; border-radius: 8px; margin-bottom: 8px;">` : ''}
          <p style="margin: 2px 0;"><strong>Fecha:</strong> ${new Date(r.created_at).toLocaleDateString()}</p>
          <p style="margin: 2px 0;"><strong>Ubicación:</strong> ${(r.localidad || '')}, ${(r.municipio || '')}, ${(r.departamento || '')}${r.country_name ? ', ' + r.country_name : ''}</p>
          <p style="margin: 2px 0;"><strong>Severidad:</strong> ${(r.severity || 'N/D')}</p>
          <p style="margin: 2px 0;"><strong>Categoría:</strong> ${(r.category || 'N/D')}</p>
          <p style="margin: 2px 0;"><strong>Precisión:</strong> ${(r.precision_level || 'N/D')}</p>
          ${typeof r.alert_radius_km === 'number' ? `<p style="margin: 2px 0;"><strong>Radio alerta:</strong> ${r.alert_radius_km} km</p>` : ''}
        </div>
      `;

      if (showMarkers && !heatmapOnly) {
        const m = L.marker([r.latitude, r.longitude], { icon: markerIcon(r.severity) }).bindPopup(popupContent);
        m.bindTooltip(`${r.diagnosis || 'Diagnóstico'} • ${r.severity || ''}`, { direction: 'top' });
        leafletMarkers.push(m);
      }

      if (showAlertCircles) {
        const radiusMeters = (r.alert_radius_km || 10) * 1000;
        const circle = L.circle([r.latitude, r.longitude], {
          radius: radiusMeters,
          color: severityColors[r.severity] || '#ef4444',
          weight: 1, fillColor: severityColors[r.severity] || '#ef4444', fillOpacity: 0.12
        });
        circle.bindTooltip(`Zona de alerta • ${r.alert_radius_km || 10} km`, { sticky: true });
        circlesLayer.current.addLayer(circle);
      }

      const intensity = r.severity === 'alta' ? 0.9 : r.severity === 'media' ? 0.6 : 0.4;
      heatPoints.push([r.latitude, r.longitude, intensity]);
    });

    if (showMarkers && !heatmapOnly) {
      if (showClusters) {
        leafletMarkers.forEach(m => clusterLayer.current.addLayer(m));
        leafletMap.current.addLayer(clusterLayer.current);

        if (!clusterTooltip.current) clusterTooltip.current = L.tooltip({ direction: 'top', className: 'cluster-tooltip' });
        clusterLayer.current.on('clustermouseover', (e) => {
          const count = e.layer.getChildCount();
          clusterTooltip.current.setLatLng(e.latlng).setContent(`${count} reportes`).addTo(leafletMap.current);
        });
        clusterLayer.current.on('clustermouseout', () => {
          if (clusterTooltip.current) leafletMap.current.removeLayer(clusterTooltip.current);
        });
      } else {
        leafletMarkers.forEach(m => markersLayer.current.addLayer(m));
      }
    }

    if (showHeatmap || heatmapOnly) {
      if (heatPoints.length > 0 && L.heatLayer) {
        heatLayer.current = L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 12 });
        heatLayer.current.addTo(leafletMap.current);
      }
    }

    // Ajustar vista a país seleccionado si no hay markers
    if (filteredReports.length === 0 && country && COUNTRY_BBOX[country]) {
      const b = COUNTRY_BBOX[country];
      const bounds = L.latLngBounds([[b.minLat, b.minLon], [b.maxLat, b.maxLon]]);
      leafletMap.current.fitBounds(bounds.pad(0.2));
      return;
    }

    // Ajustar vista a datos
    const groups = [];
    if (showMarkers && !heatmapOnly) groups.push(showClusters ? clusterLayer.current : markersLayer.current);
    if (showAlertCircles) groups.push(circlesLayer.current);

    let bounds = null;
    groups.forEach(g => {
      try { const b = g.getBounds(); if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : b; } catch {}
    });
    if (bounds && bounds.isValid()) leafletMap.current.fitBounds(bounds.pad(0.4));
    else leafletMap.current.setView([12.8654, -85.2072], 7);
  }, [filteredReports, loading, error, showMarkers, showClusters, showHeatmap, showAlertCircles, heatmapOnly, country]);

  const uniqueValues = (key) => {
    const set = new Set((reports || []).map(r => (r[key] || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  };

  const departamentos = useMemo(() => {
    if (country === 'Nicaragua') {
      // Mezcla lista completa con las encontradas en la data (evita dejar fuera deptos sin casos cargados)
      const found = uniqueValues('departamento');
      const merged = Array.from(new Set([...NIC_DEPARTAMENTOS, ...found])).sort((a, b) => a.localeCompare(b, 'es'));
      return merged;
    }
    return uniqueValues('departamento');
  }, [reports, country]);

  const municipios = uniqueValues('municipio');
  const enfermedades = uniqueValues('diagnosis');
  const categorias = taxonomy ? Array.from(new Set(taxonomy.map(t => t.categoria))).sort((a,b)=>a.localeCompare(b,'es')) : CATEGORIES;

  // Variables de entorno (CRA)
  const datasetBucket = process.env.REACT_APP_DATASET_BUCKET || "dataset_agricola";
  const datasetRoot = process.env.REACT_APP_DATASET_ROOT || "dataset_agricola";

  const openSamples = async () => {
    if (!datasetBucket || !queryCategory || !queryDiagnosis) return;
    const cultivoFolder = "frijol";
    const catFolder = slugify(queryCategory);
    const diagFolder = slugify(queryDiagnosis);
    const prefix = `${datasetRoot}/${cultivoFolder}/${catFolder}/${diagFolder}`;

    try {
      const { data, error } = await supabase.storage.from(datasetBucket).list(prefix, { limit: 12 });
      if (error) throw error;
      if (!data || data.length === 0) {
        alert("No hay muestras en el storage para esta selección.");
        return;
      }
      const toOpen = data.slice(0, 6).map(
        (f) =>
          supabase.storage.from(datasetBucket).getPublicUrl(`${prefix}/${f.name}`).data.publicUrl
      );
      toOpen.forEach((u) => {
        if (u) window.open(u, "_blank");
      });
    } catch (e) {
      console.error(e);
      alert("No fue posible abrir muestras desde Storage (revisa bucket/permissions/ENV).");
    }
  };

  const flyToFirst = () => {
    const r = filteredReports[0];
    if (r && leafletMap.current) leafletMap.current.flyTo([r.latitude, r.longitude], 12, { duration: 0.7 });
  };

  const locateUser = () => {
    if (!leafletMap.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      leafletMap.current.flyTo([latitude, longitude], 12, { duration: 0.7 });
      L.circle([latitude, longitude], { radius: 800, color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.2 }).addTo(leafletMap.current);
    });
  };

  const exportCSV = () => {
    const headers = [
      'id','latitude','longitude','diagnosis','category','created_at','image_url',
      'localidad','municipio','departamento','country_name','country_code','severity','precision_level','alert_radius_km'
    ];
    const rows = filteredReports.map(r => headers.map(h => (r[h] !== undefined && r[h] !== null) ? String(r[h]).replace(/"/g,'""') : ''));
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reports_filtered_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Heatmap-only consistency
  useEffect(() => {
    if (heatmapOnly) { setShowMarkers(false); setShowClusters(false); setShowHeatmap(true); }
  }, [heatmapOnly]);

  // Countries from data (fallback to Central America set)
  const countriesFromData = useMemo(() => {
    const d = uniqueValues('country_name');
    const base = ['Nicaragua','Honduras','El Salvador','Guatemala','Costa Rica','Panamá','México','Colombia'];
    const merged = Array.from(new Set(['Todos', ...base, ...d])).sort((a,b)=>a.localeCompare(b,'es'));
    return merged;
  }, [reports]);

  return (
    <motion.div
      className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200/50 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Casos Reportados en el Mapa</h2>
          <p className="text-gray-600">Explora, filtra y comparte vistas a nivel país, departamento y municipio (por defecto Nicaragua).</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button onClick={locateUser} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-gray-700 text-sm" title="Ir a mi ubicación">
            <Crosshair className="w-4 h-4" /> Mi ubicación
          </button>
          <button onClick={flyToFirst} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-gray-700 text-sm" title="Centrar en el primer resultado">
            <MapPin className="w-4 h-4" /> Centrar resultados
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-gray-700 text-sm" title="Exportar CSV de resultados">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">País</label>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <select className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" value={country} onChange={(e) => setCountry(e.target.value)}>
              {countriesFromData.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Departamento / Región</label>
          <select className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" value={queryDepto} onChange={(e) => setQueryDepto(e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Municipio</label>
          <input className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="Escribe el municipio" value={queryMuni} onChange={(e) => setQueryMuni(e.target.value)} />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Categoría</label>
          <select className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" value={queryCategory} onChange={(e) => setQueryCategory(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Enfermedad / Plaga</label>
          <input className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="Escribe o selecciona" list="enfermedadesList" value={queryDiagnosis} onChange={(e) => setQueryDiagnosis(e.target.value)} />
          <datalist id="enfermedadesList">
            {enfermedades.map((d) => (<option key={d} value={d} />))}
          </datalist>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Severidad</label>
          <select className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500" value={querySeverity} onChange={(e) => setQuerySeverity(e.target.value)}>
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Desde / Hasta</label>
          <div className="flex gap-2">
            <input type="date" className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 w-1/2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 w-1/2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Acciones dataset */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <button
          onClick={() => setHeatmapOnly(!heatmapOnly)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-gray-700"
          title="Alternar Solo Heatmap"
        >
          {heatmapOnly ? 'Ver marcadores' : 'Solo Heatmap'}
        </button>

        <button
          onClick={openSamples}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-gray-700"
          title="Abrir muestras del dataset para la selección actual"
        >
          Ver muestras (Storage)
        </button>

        {/* Resumen por severidad */}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{backgroundColor: severityColors.alta}}></span><span className="text-xs">Alta: {severityCount.alta}</span></div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{backgroundColor: severityColors.media}}></span><span className="text-xs">Media: {severityCount.media}</span></div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{backgroundColor: severityColors.baja}}></span><span className="text-xs">Baja: {severityCount.baja}</span></div>
        </div>
      </div>

      {/* Contenedor principal: mapa + sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <div id="map" ref={mapRef} className="w-full h-[520px] rounded-2xl border border-gray-300 shadow-md" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-white/60 rounded-2xl">
              <Loader2 className="w-10 h-10 animate-spin text-green-500 mb-2" />
              <p>Cargando reportes del mapa...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-600 bg-white/60 rounded-2xl">
              <AlertTriangle className="w-10 h-10 mb-2" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Sidebar sincronizado */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3 md:p-4 h-[520px] overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-800">Resultados ({filteredReports.length})</h3>
            </div>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border bg-white hover:bg-gray-50 text-gray-700 text-xs">
              CSV
            </button>
          </div>
          {filteredReports.length === 0 ? (
            <div className="text-gray-600 text-sm">No hay reportes para los filtros seleccionados.</div>
          ) : (
            <ul className="space-y-2">
              {filteredReports.map((r) => (
                <li key={r.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow transition cursor-pointer"
                  onClick={() => { if (leafletMap.current) leafletMap.current.flyTo([r.latitude, r.longitude], 13, { duration: 0.7 }); }}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{r.diagnosis || 'Diagnóstico'}</div>
                      <div className="text-sm text-gray-600">
                        {(r.localidad || '')}, {(r.municipio || '')}, {(r.departamento || '')}
                        {r.country_name ? `, ${r.country_name}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        {new Date(r.created_at).toLocaleDateString()} • 
                        <span className="px-2 py-0.5 rounded-full border text-[11px]" style={{borderColor: severityColors[r.severity] || '#9ca3af', color: severityColors[r.severity] || '#374151'}}>
                          {r.severity || 'N/D'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] border border-gray-200">
                          {r.precision_level || 'N/D'}
                        </span>
                        {r.category && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] border border-gray-200">{r.category}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MapDisplay;
