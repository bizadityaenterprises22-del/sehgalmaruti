import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocations, useTrips } from "@/hooks/useQueries";
import { Section } from "@/components/ui";
import { isValidPoint } from "@/lib/geo";
import { inr } from "@/lib/money";
import { todayIst } from "@/lib/dates";

const PUNE: [number, number] = [18.54, 73.8];

const pin = (html: string) => L.divIcon({ className: "", html, iconSize: [110, 26], iconAnchor: [55, 13] });
const hubIcon = pin(
  `<div style="background:#1a3c6e;color:#fff;font-weight:900;font-size:11px;padding:5px 9px;border-radius:8px;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.3);white-space:nowrap">🏭 Workshop</div>`,
);
const ptIcon = (label: string, color: string) =>
  pin(
    `<div style="background:${color};color:#fff;font-weight:800;font-size:11px;padding:4px 8px;border-radius:20px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.25);white-space:nowrap">${label}</div>`,
  );

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    else if (points.length === 1) map.setView(points[0], 13);
  }, [map, points]);
  return null;
}

/** Today's trips of the chosen workshop on the map: pick, drop, and the line between. */
export default function TripMap({ locationId }: { locationId: string | null }) {
  const { data: trips = [] } = useTrips({ locationId, day: todayIst(), status: ["planned", "running", "done"] });
  const { data: locations = [] } = useLocations();
  const hubs = locations.filter(
    (l) => l.is_active && (!locationId || l.id === locationId) && isValidPoint({ lat: l.lat ?? NaN, lng: l.lng ?? NaN }),
  );

  const points = useMemo(() => {
    const out: [number, number][] = hubs.map((h) => [h.lat!, h.lng!]);
    for (const t of trips) {
      if (isValidPoint({ lat: t.pick_lat ?? NaN, lng: t.pick_lng ?? NaN })) out.push([t.pick_lat!, t.pick_lng!]);
      if (isValidPoint({ lat: t.drop_lat ?? NaN, lng: t.drop_lng ?? NaN })) out.push([t.drop_lat!, t.drop_lng!]);
    }
    return out;
  }, [hubs, trips]);

  return (
    <Section
      title="Today's trips on the map"
      sub={`${trips.length} trip${trips.length === 1 ? "" : "s"} · pins are the pick and drop points, the line is the trip.`}
      className="!p-2"
    >
      <div className="h-[70vh] min-h-[380px] overflow-hidden rounded-lg bg-line">
        <MapContainer center={PUNE} zoom={11} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            maxZoom={19}
          />
          {hubs.map((h) => (
            <Marker key={h.id} position={[h.lat!, h.lng!]} icon={hubIcon}>
              <Popup>
                <b>{h.name}</b>
              </Popup>
            </Marker>
          ))}
          {trips.map((t) => {
            const p = isValidPoint({ lat: t.pick_lat ?? NaN, lng: t.pick_lng ?? NaN })
              ? ([t.pick_lat!, t.pick_lng!] as [number, number])
              : null;
            const d = isValidPoint({ lat: t.drop_lat ?? NaN, lng: t.drop_lng ?? NaN })
              ? ([t.drop_lat!, t.drop_lng!] as [number, number])
              : null;
            const color = t.status === "running" ? "#d97706" : t.status === "done" ? "#16a34a" : "#155eef";
            const first = (t.driver_name ?? "").split(" ")[0];
            return (
              <div key={t.id}>
                {p ? (
                  <Marker position={p} icon={ptIcon(`⬆ ${first} pick`, color)}>
                    <Popup>
                      <b>{t.driver_name}</b>
                      <br />
                      Pick: {t.pick_address}
                      <br />
                      {inr(t.amount)}
                    </Popup>
                  </Marker>
                ) : null}
                {d ? (
                  <Marker position={d} icon={ptIcon(`⬇ ${first} drop`, color)}>
                    <Popup>
                      <b>{t.driver_name}</b>
                      <br />
                      Drop: {t.drop_address}
                      <br />
                      {inr(t.amount)}
                    </Popup>
                  </Marker>
                ) : null}
                {p && d ? (
                  <Polyline positions={[p, d]} pathOptions={{ color, weight: 3, dashArray: t.status === "planned" ? "6 6" : undefined }} />
                ) : null}
              </div>
            );
          })}
          <Fit points={points} />
        </MapContainer>
      </div>
    </Section>
  );
}
