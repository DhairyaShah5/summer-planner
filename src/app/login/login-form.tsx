'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon, MailCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import {
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from './actions';

type TabValue = 'magic-link' | 'password';

export function LoginForm() {
  const [tab, setTab] = useState<TabValue>('magic-link');

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as TabValue)}
      className="gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="magic-link">Magic link</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="magic-link">
        <MagicLinkForm />
      </TabsContent>
      <TabsContent value="password">
        <PasswordForm />
      </TabsContent>
    </Tabs>
  );
}

function MagicLinkForm() {
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
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
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

type PasswordAction = 'sign-in' | 'sign-up';

function PasswordForm() {
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
    </form>
  );
}
