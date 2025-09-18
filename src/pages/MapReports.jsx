import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getReports } from '../api/reportsApi.js';
import countries from '../config/countries.json';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25,41], iconAnchor:[12,41] });
L.Marker.prototype.options.icon = DefaultIcon;

function FitToBbox({ bbox }) {
  const map = useMap();
  useEffect(() => {
    if (bbox?.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const bounds = L.latLngBounds([minLat, minLon], [maxLat, maxLon]);
      map.fitBounds(bounds, { padding: [20,20] });
    }
  }, [bbox]);
  return null;
}

export default function MapReports() {
  const [iso3, setIso3] = useState('NIC');
  const [from, setFrom] = useState('2022-01-01');
  const [to, setTo] = useState('2025-12-31');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const country = useMemo(() => countries.find(c => c.iso3 === iso3), [iso3]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getReports({ iso3, from, to });
      setReports(data);
      setLoading(false);
    })();
  }, [iso3, from, to]);

  return (
    <div className="w-full h-full">
      <div className="p-3 flex flex-wrap gap-3 items-end bg-white/80 backdrop-blur sticky top-0 z-[500] shadow">
        <label className="text-sm font-medium">
          País/Región:&nbsp;
          <select className="border rounded p-1" value={iso3} onChange={e => setIso3(e.target.value)}>
            {countries.map(c => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Desde:&nbsp;
          <input className="border rounded p-1" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Hasta:&nbsp;
          <input className="border rounded p-1" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <span className="text-xs ml-auto opacity-70">
          {loading ? 'Cargando…' : `${reports.length} registros`} · región {country?.name}
        </span>
      </div>

      <div className="w-full h-[calc(100vh-110px)]">
        <MapContainer style={{ width: '100%', height: '100%' }} center={[country?.center?.[0] ?? 12.86, country?.center?.[1] ?? -85.2]} zoom={country?.zoom ?? 7}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {country?.bbox && <FitToBbox bbox={country.bbox} />}
          {reports.filter(r => (r.y_lat && r.x_lon) || (r.lat && r.lon)).map((r, i) => {
            const lat = r.y_lat ?? r.lat;
            const lon = r.x_lon ?? r.lon;
            return (
              <Marker key={r.id || `${r.admin2}-${r.observation_date}-${i}`} position={[lat, lon]}>
                <Popup>
                  <div style={{ minWidth: 220 }}>
                    <div><strong>{r.common_name || r.agent_scientific}</strong></div>
                    <div><small><i>{r.agent_scientific}</i></small></div>
                    <div><b>Fecha:</b> {r.observation_date}</div>
                    <div><b>Nivel:</b> {r.level} · <b>Depto:</b> {r.admin1 || '—'} · <b>Municipio:</b> {r.admin2 || '—'}</div>
                    <div><b>Fuente:</b> {r.source} · <a href={r.source_url} target="_blank" rel="noreferrer">ver</a></div>
                    <div><b>Confianza:</b> {r.confidence}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
