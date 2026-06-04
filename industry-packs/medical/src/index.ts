import type { PackManifest } from "@helm/ui";

/**
 * DoctorSmart AI — the medical industry pack (Slice 1: shell config only).
 *
 * Configuration, not core logic: brand, theme key, auth model, and the
 * terminology that relabels the shared, industry-agnostic Core nav for a clinic.
 * The same Core routes (/home, /clients, /reception…) render — just relabeled.
 *
 * `auth: "isolated"` — medical is regulated; in Slice 2 it gets its own Supabase
 * project (auth + PHI in one BAA'd island). Slice 1 carries the flag but does not
 * yet act on it (demo data only, no PHI).
 */
export const medicalManifest: PackManifest = {
  id: "medical",
  productName: "DoctorSmart AI",
  logoLetter: "D",
  dataPack: "medical",
  auth: "isolated",
  terms: {
    Clients: "Patients",
    Reception: "Front Desk",
    "Voice Agent": "AI Front Desk",
    Pipeline: "Referrals",
    Books: "Billing",
  },
  tagline: "Less paperwork, more patients",
  // A complete doctor's-office example so a clinic's AI Front Desk can answer the
  // questions patients actually ask — location, the doctor's background, insurance,
  // reviews and recognitions. Demo content (a fictional clinic), not real PHI; a
  // clinic replaces it with its own non-patient business information.
  voiceContextExample: `## CLINIC
Name: Riverside Family Medicine
Location: 1240 Oak Street, Suite 200, Springfield, IL 62704 (free parking, wheelchair accessible)
Hours: Mon-Fri 8am-5pm, Sat 9am-1pm; closed Sunday. Same-week sick visits usually available.
Services: annual physicals, sick visits, chronic-care management (diabetes, blood pressure, thyroid), pediatric & adult care, vaccinations & flu shots, women's health, wellness screenings, minor procedures, and telehealth.

## DOCTOR
Name: Dr. Sarah Chen, MD — board-certified in Family Medicine
Education: MD, University of Illinois College of Medicine; Family Medicine residency at Northwestern Memorial; BS Biology, University of Michigan
Experience: 14 years in practice; special interest in preventive care and women's health; speaks English and Mandarin

## RECOGNITION & REVIEWS
Recognitions: "Top Doctor," Springfield Magazine (2022-2024); Fellow of the American Academy of Family Physicians (FAAFP); Patients' Choice Award
Patient reviews: 4.9-star average across 320+ reviews — patients highlight short wait times, clear explanations, and a caring, unhurried bedside manner

## VISITING US
Insurance: accepts most major plans (Blue Cross Blue Shield, Aetna, Cigna, UnitedHealthcare, Medicare); self-pay rates available — we verify your plan before the visit.
Appointments: new patients welcome; please arrive 15 minutes early with a photo ID and insurance card; 24-hour notice to cancel or reschedule.
Urgent & after-hours: for a medical emergency call 911; after hours, an on-call provider can be reached through this number.
Callbacks: Dr. Chen returns non-urgent patient calls between 12pm-1pm on weekdays.`,
};
