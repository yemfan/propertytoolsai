import { getPropertySeoRecordBySlug } from "../lib/property-seo/service";
import { buildPropertyJsonLd } from "../lib/property-seo/schema";
import { slugifyPropertyAddress } from "../lib/property-seo/slug";

const expected = slugifyPropertyAddress("123 Maple Ave, Pasadena, CA 91101");
console.log("demo slug:", expected);

const bad = await getPropertySeoRecordBySlug("not-a-real-slug");
if (bad !== null) throw new Error("expected null for unknown slug");

const record = await getPropertySeoRecordBySlug(expected);
if (!record) throw new Error("expected record for demo slug");
if (!record.faq.length) throw new Error("expected faq entries");
if (!record.description?.includes("Pasadena")) throw new Error("expected description");

const ld = buildPropertyJsonLd(record, "https://example.com") as {
  "@graph": unknown[];
};
if (!Array.isArray(ld["@graph"]) || ld["@graph"].length < 3) {
  throw new Error("expected JSON-LD @graph with residence, WebPage, FAQPage");
}

console.log("smoke-property-seo: OK", record.fullAddress);
