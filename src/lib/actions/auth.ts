
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
    // This will sign the user in. The client-side `onAuthStateChanged`
    // listener in `useAuth` will then pick up this change and update the state,
    // which triggers the redirect in `LoginPage`.
    await signInWithEmailAndPassword(auth, email, password);
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
