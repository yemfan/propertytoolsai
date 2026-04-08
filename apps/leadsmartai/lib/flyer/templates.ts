export type FlyerTemplate = {
  key: string;
  name: string;
  description: string;
  colors: {
    accent: string;
    accentRgb: [number, number, number];
    headerBg: string;
    headerBgRgb: [number, number, number];
    headerText: string;
    headerTextRgb: [number, number, number];
    titleColor: string;
    priceColor: string;
  };
  style: "classic" | "modern" | "luxury";
};

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Clean, professional layout with blue accents. Great for any property.",
    colors: {
      accent: "#0072CE",
      accentRgb: [0, 114, 206],
      headerBg: "#0072CE",
      headerBgRgb: [0, 114, 206],
      headerText: "#FFFFFF",
      headerTextRgb: [255, 255, 255],
      titleColor: "#0F172A",
      priceColor: "#0072CE",
    },
    style: "classic",
  },
  {
    key: "modern",
    name: "Modern",
    description: "Bold dark header with a contemporary feel. Stands out at open houses.",
    colors: {
      accent: "#6366F1",
      accentRgb: [99, 102, 241],
      headerBg: "#0F172A",
      headerBgRgb: [15, 23, 42],
      headerText: "#FFFFFF",
      headerTextRgb: [255, 255, 255],
      titleColor: "#0F172A",
      priceColor: "#6366F1",
    },
    style: "modern",
  },
  {
    key: "luxury",
    name: "Luxury",
    description: "Elegant gold accents with refined styling. Perfect for high-end properties.",
    colors: {
      accent: "#B8860B",
      accentRgb: [184, 134, 11],
      headerBg: "#1C1917",
      headerBgRgb: [28, 25, 23],
      headerText: "#D4AF37",
      headerTextRgb: [212, 175, 55],
      titleColor: "#1C1917",
      priceColor: "#B8860B",
    },
    style: "luxury",
  },
];

export function getTemplate(key: string): FlyerTemplate {
  return FLYER_TEMPLATES.find((t) => t.key === key) ?? FLYER_TEMPLATES[0];
}
