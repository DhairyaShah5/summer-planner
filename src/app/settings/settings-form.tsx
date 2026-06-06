"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormReturn, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  vault_cap: z.number().min(0),
  usc_gross_baseline: z.number().min(0),
  ntt_hourly_rate: z.number().min(0),
  usc_net_pct: z.number().min(0).max(1),
  ntt_net_pct: z.number().min(0).max(1),
  rent_monthly: z.number().min(0),
  rent_months: z.number().int().min(0),
  robinhood_weekly: z.number().min(0),
  usc_no_rent_vault: z.number().min(0),
  usc_rent_vault: z.number().min(0),
  ntt_vault_default: z.number().min(0),
});

export type SettingsFormValues = z.infer<typeof schema>;

const SETTINGS_QUERY_KEY = ["settings"] as const;

type SettingsForm = UseFormReturn<SettingsFormValues>;
type SettingsFieldName = FieldPath<SettingsFormValues>;

export function SettingsForm({
  initialValues,
  defaults,
}: {
  initialValues: SettingsFormValues;
  defaults: SettingsFormValues;
}) {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("settings")
        .update(values)
        .eq("user_id", user.id);
      if (error) throw error;
      return values;
    },
    onSuccess: (values) => {
      form.reset(values);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      toast.success("Settings saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save settings");
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("settings")
        .update(defaults)
        .eq("user_id", user.id);
      if (error) throw error;
      return defaults;
    },
    onSuccess: (values) => {
      form.reset(values);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      toast.success("Settings reset to defaults");
      setResetOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reset settings");
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-8">
        <Section index={0} title="Tuition Vault">
          <MoneyField
            form={form}
            name="vault_cap"
            label="Vault Cap"
            description="Target balance for the tuition vault."
          />
        </Section>

        <Separator />

        <Section index={1} title="Pay Assumptions">
          <MoneyField
            form={form}
            name="usc_gross_baseline"
            label="USC Gross Baseline"
            description="Default biweekly gross used for USC paychecks."
          />
          <MoneyField
            form={form}
            name="ntt_hourly_rate"
            label="NTT Hourly Rate"
            description="Hourly rate at the Colorado internship."
          />
          <PercentField
            form={form}
            name="usc_net_pct"
            label="USC Net %"
            description="Estimated net-of-gross ratio for USC."
          />
          <PercentField
            form={form}
            name="ntt_net_pct"
            label="NTT Net %"
            description="Estimated net-of-gross ratio for NTT."
          />
        </Section>

        <Separator />

        <Section index={2} title="Fixed Commitments">
          <MoneyField
            form={form}
            name="rent_monthly"
            label="Rent Monthly"
            description="Rent paid each month while in Colorado."
          />
          <IntField
            form={form}
            name="rent_months"
            label="Rent Months"
            description="Number of months rent will be paid."
          />
          <MoneyField
            form={form}
            name="robinhood_weekly"
            label="Robinhood Weekly"
            description="Weekly Robinhood deposit (doubled per biweekly USC check)."
          />
        </Section>

        <Separator />

        <Section index={3} title="Allocation Rules">
          <MoneyField
            form={form}
            name="usc_no_rent_vault"
            label="USC No-Rent Vault"
            description="Default vault deposit on USC checks with no rent."
          />
          <MoneyField
            form={form}
            name="usc_rent_vault"
            label="USC Rent Vault"
            description="Default vault deposit on USC checks that also pay rent."
          />
          <MoneyField
            form={form}
            name="ntt_vault_default"
            label="NTT default vault $ per check"
            description="Default vault deposit on each NTT paycheck."
          />
        </Section>

        <div className="flex items-center justify-end gap-2">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset(initialValues)}
              disabled={mutation.isPending || !form.formState.isDirty}
            >
              Discard changes
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.formState.isDirty}
              className="transition-transform"
            >
              {mutation.isPending ? "Saving..." : "Save settings"}
            </Button>
          </motion.div>
        </div>
      </form>

      <div className="mt-8">
        <Separator />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Reset every field to the original migration defaults.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setResetOpen(true)}
            disabled={resetMutation.isPending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Reset to defaults
          </Button>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all settings?</DialogTitle>
            <DialogDescription>
              This replaces every field with the original migration defaults. Your
              current values will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Resetting..." : "Reset to defaults"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  title,
  children,
  index = 0,
}: {
  title: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="space-y-4"
    >
      <h2 className="font-heading text-base font-medium">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </motion.section>
  );
}

type FieldProps = {
  form: SettingsForm;
  name: SettingsFieldName;
  label: string;
  description?: string;
};

function MoneyField({ form, name, label, description }: FieldProps) {
  const error = form.formState.errors[name];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label} ($)</Label>
      <Input
        id={name}
        type="number"
        step="0.01"
        inputMode="decimal"
        aria-invalid={!!error}
        {...form.register(name, { valueAsNumber: true })}
      />
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error?.message && (
        <p className="text-xs text-destructive">{String(error.message)}</p>
      )}
    </div>
  );
}

function IntField({ form, name, label, description }: FieldProps) {
  const error = form.formState.errors[name];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type="number"
        step="1"
        inputMode="numeric"
        aria-invalid={!!error}
        {...form.register(name, { valueAsNumber: true })}
      />
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error?.message && (
        <p className="text-xs text-destructive">{String(error.message)}</p>
      )}
    </div>
  );
}

function PercentField({ form, name, label, description }: FieldProps) {
  const value = form.watch(name);
  const error = form.formState.errors[name];
  const numericValue = typeof value === "number" ? value : Number(value);
  const canonicalDisplay = Number.isFinite(numericValue)
    ? (numericValue * 100).toFixed(4)
    : "";

  // Local input string so typing isn't disrupted by re-renders. We only sync
  // from form state when the underlying decimal value diverges from what the
  // local string would produce (e.g. reset to defaults, discard changes).
  const [localText, setLocalText] = useState<string>(canonicalDisplay);
  const lastSyncedRef = useRef<number>(numericValue);

  useEffect(() => {
    if (numericValue !== lastSyncedRef.current) {
      const parsedLocal = parseFloat(localText);
      const localAsDecimal = Number.isFinite(parsedLocal) ? parsedLocal / 100 : NaN;
      // Only overwrite local text if the form value was changed externally
      // (i.e. doesn't match what the user has currently typed).
      if (
        !Number.isFinite(localAsDecimal) ||
        Math.abs(localAsDecimal - numericValue) > 1e-9
      ) {
        setLocalText(canonicalDisplay);
      }
      lastSyncedRef.current = numericValue;
    }
  }, [numericValue, canonicalDisplay, localText]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${name}-display`}>{label} (%)</Label>
      <div className="relative">
        <Input
          id={`${name}-display`}
          type="number"
          step="0.0001"
          inputMode="decimal"
          value={localText}
          aria-invalid={!!error}
          className="pr-8"
          onChange={(e) => {
            const raw = e.target.value;
            setLocalText(raw);
            const pct = parseFloat(raw);
            const next = Number.isFinite(pct) ? pct / 100 : 0;
            lastSyncedRef.current = next;
            form.setValue(name, next, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
      {description && !error && (
        <p className="text-xs text-muted-foreground">
          {description} Stored as {numericValue.toFixed(6)}.
        </p>
      )}
      {error?.message && (
        <p className="text-xs text-destructive">{String(error.message)}</p>
      )}
    </div>
  );
}
