'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

export type SignInResult = { ok: boolean; error?: string };

export async function signInWithMagicLink(
  formData: FormData,
): Promise<SignInResult> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Invalid email.';
    return { ok: false, error: issue };
  }

  const headerList = await headers();
  const origin =
    headerList.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
