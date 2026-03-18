import { z } from "zod";

export const violationSchema = z.object({
  property_id: z.number().int().positive(),
  category_id: z.number().int().positive().optional(),
  description: z.string().min(1, "Description is required").max(2000),
  fine_amount: z.number().positive().optional(),
  due_date: z.string().optional(),
  status: z.enum(["open", "resolved", "appealed", "closed"]).default("open"),
});

export const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  owner_name: z.string().min(1, "Owner name is required"),
  owner_email: z.string().email("Invalid email address"),
  owner_phone: z.string().optional(),
  parcel_number: z.string().optional(),
  notes: z.string().optional(),
});

export const violationCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  default_fine: z.number().positive().optional(),
});

export const appealSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(5000),
  contact_name: z.string().min(1, "Contact name is required"),
  contact_email: z.string().email("Invalid email address"),
  contact_phone: z.string().optional(),
});

export type ViolationInput = z.infer<typeof violationSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type ViolationCategoryInput = z.infer<typeof violationCategorySchema>;
export type AppealInput = z.infer<typeof appealSchema>;
