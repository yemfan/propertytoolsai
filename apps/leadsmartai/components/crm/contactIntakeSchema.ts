import { z } from "zod";

const optionalTrimmed = z
  .string()
  .max(320)
  .optional()
  .nullable()
  .transform((v) => (v == null ? "" : String(v).trim()));

export const contactIntakeBodySchema = z
  .object({
    name: z.string().max(200).optional().nullable(),
    email: optionalTrimmed,
    phone: z.string().max(40).optional().nullable(),
    property_address: z.string().max(500).optional().nullable(),
    notes: z.string().max(8000).optional().nullable(),
    source: z.string().max(120).optional().nullable(),
    forceCreate: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const name = (data.name ?? "").trim();
    const email = (data.email ?? "").trim();
    const phone = (data.phone ?? "").trim();
    if (!name && !email && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter at least a name, email, or phone number.",
        path: ["name"],
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid email address.", path: ["email"] });
    }
  });

export type ContactIntakeBody = z.infer<typeof contactIntakeBodySchema>;
