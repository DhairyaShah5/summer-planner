import { redirect } from 'next/navigation';
import { Sun } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

import { LoginForm } from './login-form';

export const metadata = {
  title: 'Sign in · Summer Planner',
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sun className="size-5" />
          </div>
          <CardTitle className="text-lg">Summer Planner</CardTitle>
          <CardDescription>
            Sign in with a magic link or your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
