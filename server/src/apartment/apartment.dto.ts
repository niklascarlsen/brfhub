import {z} from 'zod';

const labelSchema = z.string().trim().min(1).max(20);
const residentNameSchema = z.string().trim().min(1).max(100);
// Trimmed and lower-cased before it is checked, as people type it.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const apartmentSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  residentName: z.string(),
  email: z.string(),
  lastSignInOn: z.iso.date().nullable(),
  upcomingBookings: z.number().int(),
});

export const createApartmentBodySchema = z.object({
  label: labelSchema,
  residentName: residentNameSchema,
  email: emailSchema,
});

export const updateApartmentBodySchema = z.object({
  label: labelSchema.optional(),
  residentName: residentNameSchema.optional(),
  email: emailSchema.optional(),
});

export const newResidentBodySchema = z.object({
  residentName: residentNameSchema,
  email: emailSchema,
});

export const apartmentParamsSchema = z.object({
  id: z.uuid(),
});

export type Apartment = z.infer<typeof apartmentSchema>;
export type CreateApartmentBody = z.infer<typeof createApartmentBodySchema>;
export type UpdateApartmentBody = z.infer<typeof updateApartmentBodySchema>;
export type NewResidentBody = z.infer<typeof newResidentBodySchema>;

z.globalRegistry.add(apartmentSchema, {id: 'Apartment'});
z.globalRegistry.add(createApartmentBodySchema, {id: 'CreateApartmentBody'});
z.globalRegistry.add(updateApartmentBodySchema, {id: 'UpdateApartmentBody'});
z.globalRegistry.add(newResidentBodySchema, {id: 'NewResidentBody'});
