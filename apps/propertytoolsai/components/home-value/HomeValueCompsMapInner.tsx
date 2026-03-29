"use client";

import Map, { Marker, Popup } from "react-map-gl/mapbox";
import { useMemo } from "react";
import type { ComparableHome, SubjectHome } from "./homeValueCompsShared";
import { comparableHomeKey, fmtDate, money } from "./homeValueCompsShared";

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

  const initialViewState = useMemo(
    () => ({
      latitude: subject.lat,
      longitude: subject.lng,
      zoom: 13.5,
    }),
    [subject.lat, subject.lng]
  );

  return (
    <div className="h-[520px] border-b lg:border-b-0 lg:border-r">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
      >
        <Marker latitude={subject.lat} longitude={subject.lng} anchor="bottom">
          <button
            type="button"
            className="rounded-full border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-sm"
          >
            Subject
          </button>
        </Marker>

        {comps.map((comp, index) => {
          if (typeof comp.lat !== "number" || typeof comp.lng !== "number") return null;
          const rowKey = comparableHomeKey(comp, index);
          const selected = rowKey === selectedId;
          return (
            <Marker key={rowKey} latitude={comp.lat} longitude={comp.lng} anchor="bottom">
              <button
                type="button"
                onClick={() => onSelect(rowKey)}
                className={[
                  "rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition",
                  selected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-white bg-white text-gray-900 hover:bg-gray-50",
                ].join(" ")}
              >
                #{index + 1}
              </button>
            </Marker>
          );
        })}

        {selectedComp &&
        typeof selectedComp.lat === "number" &&
        typeof selectedComp.lng === "number" ? (
          <Popup
            latitude={selectedComp.lat}
            longitude={selectedComp.lng}
            anchor="top"
            onClose={() => onSelect(null)}
            closeButton={true}
            offset={20}
          >
            <div className="max-w-[240px] p-1 text-sm">
              <div className="font-semibold text-gray-900">{selectedComp.address}</div>
              <div className="mt-1 text-gray-600">Sold {fmtDate(selectedComp.soldDate)}</div>
              <div className="mt-2 font-semibold text-gray-900">{money(selectedComp.soldPrice)}</div>
              <div className="mt-1 text-gray-600">
                {selectedComp.sqft?.toLocaleString() || "—"} sqft • {selectedComp.beds ?? "—"} bd •{" "}
                {selectedComp.baths ?? "—"} ba
              </div>
              <div className="mt-1 text-gray-600">{selectedComp.distanceMiles.toFixed(2)} mi away</div>
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}
