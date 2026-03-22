import {
  HOME_VALUE_DISCLAIMER_RANGE,
  HOME_VALUE_DISCLAIMER_SHORT,
} from "@/lib/homeValue/estimateDisplay";

type Props = {
  className?: string;
  /** Include line about showing a range */
  showRangeNote?: boolean;
};

export default function HomeValueTrustDisclaimer({ className = "", showRangeNote = true }: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-600 ${className}`}
      role="note"
    >
      <p className="font-medium text-slate-700">{HOME_VALUE_DISCLAIMER_SHORT}</p>
      {showRangeNote ? <p className="mt-1">{HOME_VALUE_DISCLAIMER_RANGE}</p> : null}
    </div>
  );
}
