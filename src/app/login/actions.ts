'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export type SignInResult = { ok: boolean; error?: string };

export type SignUpResult = {
  ok: boolean;
  needsConfirmation: boolean;
  error?: string;
};

export async function signInWithPassword(
  formData: FormData,
): Promise<SignInResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Invalid credentials.';
    return { ok: false, error: issue };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signUpWithPassword(
  formData: FormData,
): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Invalid credentials.';
    return { ok: false, needsConfirmation: false, error: issue };
  }

  const headerList = await headers();
  const origin =
    headerList.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
    },
  });

  if (error) {
    return { ok: false, needsConfirmation: false, error: error.message };
  }

  return { ok: true, needsConfirmation: data.session === null };
}
