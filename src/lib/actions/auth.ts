
'use server';

import { z } from 'zod';
import { auth, isConfigured } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export async function login(prevState: string | undefined, formData: FormData) {
  const validatedFields = LoginSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return 'Invalid email or password.';
  }

  const { email, password } = validatedFields.data;

  if (!isConfigured) {
    return 'Firebase is not configured.';
  }

  try {
    // Note: Server-side SDK would be better here, but for simplicity
    // we use the client SDK. This is less secure as it exposes API keys.
    await signInWithEmailAndPassword(auth, email, password);
    // On the client, the onAuthStateChanged listener will handle redirection.
    return undefined;
  } catch (error: any) {
    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          return 'Invalid email or password.';
        default:
          return 'Something went wrong. Please try again.';
      }
    }
    return 'An unknown error occurred.';
  }
}
