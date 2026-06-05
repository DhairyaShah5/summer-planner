'use client';

import { useState, useTransition } from 'react';
import { Loader2Icon, MailCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { signInWithMagicLink } from './actions';

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim();

    startTransition(async () => {
      const result = await signInWithMagicLink(formData);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not send magic link.');
        return;
      }
      setSentTo(email);
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a magic link to{' '}
            <span className="font-medium text-foreground">{sentTo}</span>. Open
            it on this device to sign in.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSentTo(null)}
          className="mt-1"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={isPending}
        />
      </div>
      <Button type="submit" disabled={isPending} className="mt-1">
        {isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Sending link...
          </>
        ) : (
          'Send magic link'
        )}
      </Button>
    </form>
  );
}
