
'use server';

import { z } from 'zod';
import { auth, isConfigured } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export interface LoginState {
  success: boolean;
  message?: string;
}

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validatedFields = LoginSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid email or password.' };
  }

  const { email, password } = validatedFields.data;

  if (!isConfigured) {
    return { success: false, message: 'Firebase is not configured.' };
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (error: any) {
    let message = 'An unknown error occurred.';
    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Invalid email or password.';
          break;
        default:
          message = 'Something went wrong. Please try again.';
          break;
      }
    }
    return { success: false, message };
  }
}
