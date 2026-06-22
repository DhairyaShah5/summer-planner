'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2Icon, MailCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { signInWithPassword, signUpWithPassword } from './actions';
import { enterViewMode } from './view-mode-action';

type PasswordAction = 'sign-in' | 'sign-up';

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PasswordAction | null>(
    null,
  );
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  function run(action: PasswordAction, formData: FormData) {
    setPendingAction(action);
    startTransition(async () => {
      try {
        const email = String(formData.get('email') ?? '').trim();

        if (action === 'sign-in') {
          const result = await signInWithPassword(formData);
          if (!result.ok) {
            toast.error(result.error ?? 'Could not sign in.');
            return;
          }
          router.push('/');
          router.refresh();
          return;
        }

        const result = await signUpWithPassword(formData);
        if (!result.ok) {
          toast.error(result.error ?? 'Could not create account.');
          return;
        }
        if (result.needsConfirmation) {
          setConfirmEmail(email);
          return;
        }
        router.push('/');
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function onSubmit(formData: FormData) {
    // Default submit (e.g. Enter key in an input) signs in.
    run('sign-in', formData);
  }

  if (confirmEmail) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Check your email to confirm</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{confirmEmail}</span>.
            Open it to finish creating your account.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmEmail(null)}
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
        <Label htmlFor="password-email">Email</Label>
        <Input
          id="password-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password-password">Password</Label>
        <Input
          id="password-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          disabled={isPending}
        />
      </div>
      <div className="mt-1 flex gap-2">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1"
          formAction={(formData) => run('sign-in', formData)}
        >
          {isPending && pendingAction === 'sign-in' ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          className="flex-1"
          formAction={(formData) => run('sign-up', formData)}
        >
          {isPending && pendingAction === 'sign-up' ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Signing up...
            </>
          ) : (
            'Sign up'
          )}
        </Button>
      </div>

      <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await enterViewMode();
          });
        }}
        className="w-full gap-2"
      >
        <Eye className="size-4" />
        View only (read-only demo)
      </Button>
    </form>
  );
}
