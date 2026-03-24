"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  error?: string | null;
  id?: string;
};

export function AddressInput({
  value,
  onChange,
  onSubmit,
  disabled,
  error,
  id = "hv-address",
}: Props) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        Property address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          id={id}
          type="text"
          autoComplete="street-address"
          placeholder="123 Main St, City, ST 12345"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!disabled) onSubmit();
            }
          }}
          disabled={disabled}
          className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-[#0072ce]/0 transition placeholder:text-slate-400 focus:border-[#0072ce]/40 focus:ring-4 focus:ring-[#0072ce]/15 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || value.trim().length < 8}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl bg-[#0072ce] px-8 text-sm font-semibold text-white shadow-md shadow-[#0072ce]/25 transition hover:bg-[#0062b8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          Get estimate
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
