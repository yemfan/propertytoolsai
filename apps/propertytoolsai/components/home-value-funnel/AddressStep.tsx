"use client";

type Props = {
  address: string;
  error: string | null;
  onAddressChange: (v: string) => void;
  onSubmit: () => void;
};

export default function AddressStep({ address, error, onAddressChange, onSubmit }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          What&apos;s your property address?
        </h2>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Enter a full street address so we can match local market data. This is not an appraisal — you&apos;ll get an
          <span className="font-medium text-gray-800"> estimated value range</span> and a{" "}
          <span className="font-medium text-gray-800">confidence score</span>.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="block">
          <span className="sr-only">Street address</span>
          <input
            type="text"
            autoComplete="street-address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="123 Main St, City, ST 12345"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 shadow-sm outline-none ring-[#0072ce]/0 transition placeholder:text-gray-400 focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-2xl bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 sm:text-base"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
