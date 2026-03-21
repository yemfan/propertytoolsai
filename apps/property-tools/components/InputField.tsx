"use client";

import { ChangeEvent } from "react";

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function InputField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
