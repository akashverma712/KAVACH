import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

// BIT Sindri campus (approximate) — used until a GPS fix arrives
export const CAMPUS = { lat: 23.6524, lng: 86.4897 };

const youIcon = L.divIcon({ className: '', html: '<div class="you-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function Follow({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [coords?.lat, coords?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapView({ coords, className = 'h-64' }) {
  const center = coords || CAMPUS;
  return (
    <div className={`relative isolate z-0 overflow-hidden rounded-panel border border-line ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={coords ? 16 : 15} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {coords && (
          <>
            {coords.accuracy && coords.accuracy < 2000 && (
              <Circle center={[coords.lat, coords.lng]} radius={coords.accuracy} pathOptions={{ color: '#E0243A', weight: 1, fillOpacity: 0.08 }} />
            )}
            <Marker position={[coords.lat, coords.lng]} icon={youIcon} />
          </>
        )}
        <Follow coords={coords} />
      </MapContainer>
    </div>
  );
}
