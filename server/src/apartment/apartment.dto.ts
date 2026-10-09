import {z} from 'zod';

const labelSchema = z.string().trim().min(1).max(20);
const residentNameSchema = z.string().trim().min(1).max(100);
const emailSchema = z.email().trim().toLowerCase();

export const apartmentSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  // Null only when the apartment has no account, after a new resident
  // could not be added.
  residentName: z.string().nullable(),
  email: z.string().nullable(),
  lastSignInAt: z.iso.datetime().nullable(),
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

export const apartmentWithPasswordSchema = z.object({
  apartment: apartmentSchema,
  password: z.string(),
});

export const passwordSchema = z.object({
  password: z.string(),
});

export type Apartment = z.infer<typeof apartmentSchema>;
export type CreateApartmentBody = z.infer<typeof createApartmentBodySchema>;
export type UpdateApartmentBody = z.infer<typeof updateApartmentBodySchema>;
export type NewResidentBody = z.infer<typeof newResidentBodySchema>;

z.globalRegistry.add(apartmentSchema, {id: 'Apartment'});
z.globalRegistry.add(createApartmentBodySchema, {id: 'CreateApartmentBody'});
z.globalRegistry.add(updateApartmentBodySchema, {id: 'UpdateApartmentBody'});
z.globalRegistry.add(newResidentBodySchema, {id: 'NewResidentBody'});
z.globalRegistry.add(apartmentWithPasswordSchema, {
  id: 'ApartmentWithPassword',
});
z.globalRegistry.add(passwordSchema, {id: 'GeneratedPassword'});
