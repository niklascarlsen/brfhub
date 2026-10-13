import {z} from 'zod';

export const signInMethodBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const signInMethodSchema = z.object({
  method: z.enum(['code', 'password']),
});

export type SignInMethod = z.infer<typeof signInMethodSchema>;

z.globalRegistry.add(signInMethodBodySchema, {id: 'SignInMethodBody'});
z.globalRegistry.add(signInMethodSchema, {id: 'SignInMethod'});
