"use client";

import type { EstimateDetails, PropertyCondition, PropertyType } from "@/lib/home-value/types";

const fieldBorder = "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400";

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={fieldBorder}
      />
    </div>
  );
}

type Props = {
  details: EstimateDetails;
  onChange: (patch: Partial<EstimateDetails>) => void;
  onRefresh: () => void;
  isBusy: boolean;
};

export function RefinementForm({ details, onChange, onRefresh, isBusy }: Props) {
  const yearMax = new Date().getFullYear() + 1;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Want a More Accurate Estimate?</h2>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Add a few details and refresh the estimate to improve confidence.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isBusy ? "Updating..." : "Update Estimate"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NumberField label="Bedrooms" value={details.beds} min={0} onChange={(v) => onChange({ beds: v })} />
        <NumberField
          label="Bathrooms"
          value={details.baths}
          min={0}
          step={0.5}
          onChange={(v) => onChange({ baths: v })}
        />
        <NumberField label="Square Feet" value={details.sqft} min={100} onChange={(v) => onChange({ sqft: v })} />
        <NumberField
          label="Year Built"
          value={details.yearBuilt}
          min={1800}
          max={yearMax}
          onChange={(v) => onChange({ yearBuilt: v })}
        />
        <NumberField label="Lot Size" value={details.lotSize} min={0} onChange={(v) => onChange({ lotSize: v })} />

        <div>
          <label className="mb-1 block text-sm text-gray-600">Property Type</label>
          <select
            value={details.propertyType ?? ""}
            onChange={(e) =>
              onChange({
                propertyType: e.target.value ? (e.target.value as PropertyType) : undefined,
              })
            }
            className={`${fieldBorder} bg-white`}
          >
            <option value="">Select type</option>
            <option value="single_family">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
            <option value="multi_family">Multi Family</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Condition</label>
          <select
            value={details.condition ?? ""}
            onChange={(e) =>
              onChange({
                condition: e.target.value ? (e.target.value as PropertyCondition) : undefined,
              })
            }
            className={`${fieldBorder} bg-white`}
          >
            <option value="">Select condition</option>
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="good">Good</option>
            <option value="excellent">Excellent</option>
          </select>
        </div>

        {/* Renovation section */}
        <div className="col-span-full rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <input
              id="renovationDone"
              type="checkbox"
              checked={!!details.renovation?.done}
              onChange={(e) =>
                onChange({
                  renovation: e.target.checked
                    ? { done: true, scope: "full" }
                    : { done: false },
                })
              }
              className="h-4 w-4"
            />
            <label htmlFor="renovationDone" className="text-sm font-medium text-gray-700">
              Renovated recently
            </label>
          </div>

          {details.renovation?.done ? (
            <div className="mt-4 space-y-4 pl-7">
              {/* Year of renovation */}
              <div>
                <label className="mb-1 block text-sm text-gray-600">Year of renovation</label>
                <input
                  type="number"
                  min={1950}
                  max={new Date().getFullYear()}
                  value={details.renovation.year ?? ""}
                  onChange={(e) =>
                    onChange({
                      renovation: {
                        ...details.renovation!,
                        year: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className={fieldBorder + " max-w-[160px]"}
                  placeholder="e.g. 2022"
                />
              </div>

              {/* Scope radio buttons */}
              <div>
                <label className="mb-2 block text-sm text-gray-600">Scope</label>
                <div className="flex flex-wrap gap-3">
                  {(["full", "partial", "addition"] as const).map((scope) => (
                    <label
                      key={scope}
                      className={[
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition",
                        details.renovation?.scope === scope
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-slate-200 bg-white text-gray-700 hover:border-gray-300",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="renovationScope"
                        value={scope}
                        checked={details.renovation?.scope === scope}
                        onChange={() =>
                          onChange({
                            renovation: {
                              ...details.renovation!,
                              scope,
                              rooms: scope !== "full" ? details.renovation?.rooms ?? [] : undefined,
                              sqftAdded: scope === "addition" ? details.renovation?.sqftAdded : undefined,
                            },
                          })
                        }
                        className="sr-only"
                      />
                      {scope === "full" ? "Full" : scope === "partial" ? "Partial" : "Addition"}
                    </label>
                  ))}
                </div>
              </div>

              {/* Room checkboxes for partial or addition */}
              {(details.renovation?.scope === "partial" || details.renovation?.scope === "addition") ? (
                <div>
                  <label className="mb-2 block text-sm text-gray-600">
                    {details.renovation.scope === "partial" ? "Rooms renovated" : "Rooms added"}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {(["kitchen", "bath", "bedroom"] as const).map((room) => {
                      const checked = details.renovation?.rooms?.includes(room) ?? false;
                      return (
                        <label
                          key={room}
                          className={[
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                            checked
                              ? "border-gray-900 bg-gray-50 text-gray-900"
                              : "border-slate-200 text-gray-600 hover:border-gray-300",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = details.renovation?.rooms ?? [];
                              const next = e.target.checked
                                ? [...current, room]
                                : current.filter((r) => r !== room);
                              onChange({
                                renovation: { ...details.renovation!, rooms: next },
                              });
                            }}
                            className="h-4 w-4"
                          />
                          {room.charAt(0).toUpperCase() + room.slice(1)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Square feet added — addition only */}
              {details.renovation?.scope === "addition" ? (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Square feet added</label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={details.renovation.sqftAdded ?? ""}
                    onChange={(e) =>
                      onChange({
                        renovation: {
                          ...details.renovation!,
                          sqftAdded: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className={fieldBorder + " max-w-[160px]"}
                    placeholder="e.g. 400"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
