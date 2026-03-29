export function getHolidayForDate(date: Date) {
  const mmdd = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  const fixed: Record<string, { key: string; label: string }> = {
    "01-01": { key: "new_year", label: "New Year" },
    "02-14": { key: "valentines_day", label: "Valentine's Day" },
    "07-04": { key: "independence_day", label: "Independence Day" },
    "10-31": { key: "halloween", label: "Halloween" },
    "11-11": { key: "veterans_day", label: "Veterans Day" },
    "12-24": { key: "christmas_eve", label: "Christmas Eve" },
    "12-25": { key: "christmas", label: "Christmas" },
    "12-31": { key: "new_year_eve", label: "New Year's Eve" },
  };

  return fixed[mmdd] || null;
}
