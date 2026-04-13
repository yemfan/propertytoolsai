"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ComparableHome, SubjectHome } from "./homeValueCompsShared";
import { comparableHomeKey, fmtDate, money } from "./homeValueCompsShared";

/* ── Leaflet CSS (loaded once) ── */
import "leaflet/dist/leaflet.css";

/* ── Custom marker icons (inline SVG → data URI so we don't need image files) ── */
function svgIcon(label: string, bg: string, text: string, border: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 36],
    popupAnchor: [0, -38],
    html: `<div style="
      display:inline-flex;align-items:center;justify-content:center;
      padding:6px 12px;border-radius:9999px;
      background:${bg};color:${text};border:2px solid ${border};
      font-size:12px;font-weight:600;white-space:nowrap;
      box-shadow:0 1px 3px rgba(0,0,0,.18);
      transform:translate(-50%,0);
    ">${label}</div>`,
  });
}

const subjectIcon = svgIcon("Subject", "#111827", "#fff", "#111827");

function compIcon(index: number, selected: boolean) {
  return selected
    ? svgIcon(`#${index + 1}`, "#111827", "#fff", "#111827")
    : svgIcon(`#${index + 1}`, "#fff", "#111827", "#e5e7eb");
}

/* ── Recenter helper ── */
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });
  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
      map.setView([lat, lng], 13.5, { animate: true });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

export default function HomeValueCompsMapInner({
  subject,
  comps,
  selectedId,
  onSelect,
}: {
  subject: SubjectHome;
  comps: ComparableHome[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const selectedComp = useMemo(() => {
    if (selectedId == null) return null;
    const idx = comps.findIndex((comp, i) => comparableHomeKey(comp, i) === selectedId);
    return idx >= 0 ? comps[idx] : null;
  }, [comps, selectedId]);

  return (
    <div className="h-[520px] border-b lg:border-b-0 lg:border-r">
      <MapContainer
        center={[subject.lat, subject.lng]}
        zoom={13.5}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <RecenterMap lat={subject.lat} lng={subject.lng} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Subject marker */}
        <Marker position={[subject.lat, subject.lng]} icon={subjectIcon} />

        {/* Comp markers */}
        {comps.map((comp, index) => {
          if (typeof comp.lat !== "number" || typeof comp.lng !== "number") return null;
          const rowKey = comparableHomeKey(comp, index);
          const selected = rowKey === selectedId;
          return (
            <Marker
              key={rowKey}
              position={[comp.lat, comp.lng]}
              icon={compIcon(index, selected)}
              eventHandlers={{ click: () => onSelect(rowKey) }}
            />
          );
        })}

        {/* Selected comp popup */}
        {selectedComp &&
        typeof selectedComp.lat === "number" &&
        typeof selectedComp.lng === "number" ? (
          <Popup
            position={[selectedComp.lat, selectedComp.lng]}
            eventHandlers={{ remove: () => onSelect(null) }}
          >
            <div className="max-w-[240px] p-1 text-sm">
              <div className="font-semibold text-gray-900">{selectedComp.address}</div>
              <div className="mt-1 text-gray-600">Sold {fmtDate(selectedComp.soldDate)}</div>
              <div className="mt-2 font-semibold text-gray-900">{money(selectedComp.soldPrice)}</div>
              <div className="mt-1 text-gray-600">
                {selectedComp.sqft?.toLocaleString() || "\u2014"} sqft \u2022 {selectedComp.beds ?? "\u2014"} bd \u2022{" "}
                {selectedComp.baths ?? "\u2014"} ba
              </div>
              <div className="mt-1 text-gray-600">{selectedComp.distanceMiles.toFixed(2)} mi away</div>
            </div>
          </Popup>
        ) : null}
      </MapContainer>
    </div>
  );
}
