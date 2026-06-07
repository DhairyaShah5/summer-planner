"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, type UseFormReturn, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Flag,
  Vault as VaultIcon,
  Home as HomeIcon,
  TrendingUp,
  Landmark,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Reveal,
  SectionLabel,
  AccountGlyph,
  fmtMoney,
  fmtDate,
} from "@/components/redesign";

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
  rollover_sweep_threshold: z.number().min(0),
  rollover_sweep_cushion: z.number().min(0),
});

export type SettingsFormValues = z.infer<typeof schema>;

const SETTINGS_QUERY_KEY = ["settings"] as const;

// Deadline isn't persisted in the settings table; lock to the Fall 2026 due date.
const FALL_2026_DEADLINE = "2026-08-28";
const FALL_2026_TERM = "Fall 2026";

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

  const vaultTarget = form.watch("vault_cap");

  return (
    <>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          className="settings-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Reveal>
            <Card>
              <SectionLabel>Tuition goal</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <SField label="Vault target">
                  <MoneyInput form={form} name="vault_cap" />
                </SField>
                <SField label="Deadline">
                  <input
                    className="inp"
                    type="date"
                    value={FALL_2026_DEADLINE}
                    readOnly
                    aria-readonly
                    style={inpStyle}
                  />
                </SField>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "var(--surface-2)",
                  font: "500 13px var(--ui)",
                  color: "var(--ink-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Flag size={14} color="var(--accent)" />
                {FALL_2026_TERM} · {fmtMoney(vaultTarget)} by{" "}
                {fmtDate(FALL_2026_DEADLINE, "short")}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={50}>
            <Card>
              <SectionLabel>Employers</SectionLabel>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <EmployerRow
                  code="USC"
                  hue={235}
                  caption="Biweekly gross + net %"
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <MoneyField
                      form={form}
                      name="usc_gross_baseline"
                      label="Gross baseline"
                    />
                    <PercentField
                      form={form}
                      name="usc_net_pct"
                      label="Net %"
                    />
                  </div>
                </EmployerRow>
                <EmployerRow
                  code="NTT"
                  hue={150}
                  caption="Hourly rate + net %"
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <MoneyField
                      form={form}
                      name="ntt_hourly_rate"
                      label="Hourly rate"
                    />
                    <PercentField
                      form={form}
                      name="ntt_net_pct"
                      label="Net %"
                    />
                  </div>
                </EmployerRow>
              </div>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <Card>
            <SectionLabel>Rent, Robinhood & vault defaults</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <MoneyField
                form={form}
                name="rent_monthly"
                label="Rent monthly"
                description="Rent paid each month while in Colorado."
              />
              <IntField
                form={form}
                name="rent_months"
                label="Rent months"
                description="Number of months rent will be paid."
              />
              <MoneyField
                form={form}
                name="robinhood_weekly"
                label="Robinhood weekly"
                description="Weekly deposit (doubled per biweekly USC check)."
              />
              <MoneyField
                form={form}
                name="usc_no_rent_vault"
                label="USC no-rent vault"
                description="Default vault on USC checks with no rent."
              />
              <MoneyField
                form={form}
                name="usc_rent_vault"
                label="USC rent vault"
                description="Default vault on USC checks that pay rent."
              />
              <MoneyField
                form={form}
                name="ntt_vault_default"
                label="NTT default vault"
                description="Default vault deposit on each NTT paycheck."
              />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={125}>
          <Card>
            <SectionLabel>Rollover sweep</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <MoneyField
                form={form}
                name="rollover_sweep_threshold"
                label="Threshold"
              />
              <MoneyField
                form={form}
                name="rollover_sweep_cushion"
                label="Cushion"
              />
            </div>
            <p
              style={{
                marginTop: 10,
                font: "400 12px/1.5 var(--ui)",
                color: "var(--ink-3)",
              }}
            >
              When unspent CO from earlier weeks reaches the threshold, the
              Weekly Tracker offers to sweep the excess (minus the cushion) to
              BofA.
            </p>
          </Card>
        </Reveal>

        <Reveal delay={150}>
          <Card>
            <SectionLabel
              right={
                <span
                  style={{
                    font: "500 12px var(--ui)",
                    color: "var(--ink-3)",
                  }}
                >
                  Per diem → BofA · OT → BofA · Hourly → Vault
                </span>
              }
            >
              Allocation buckets
            </SectionLabel>
            <div
              className="cascade-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 12,
              }}
            >
              {BUCKETS.map((b, i) => (
                <div
                  key={b.id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hair)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <AccountGlyph hue={b.hue} icon={b.icon} size={34} />
                    <span
                      style={{
                        font: "600 12px var(--display)",
                        color: "var(--ink-4)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div
                    style={{
                      font: "600 14px var(--ui)",
                      color: "var(--ink-1)",
                    }}
                  >
                    {b.label}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              padding: "4px 4px 0",
            }}
          >
            <motion.div whileTap={{ scale: 0.97 }}>
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
            </motion.div>
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
        </Reveal>
      </form>

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

const BUCKETS: Array<{
  id: string;
  label: string;
  hue: number;
  icon: ReactNode;
}> = [
  { id: "vault", label: "Vault", hue: 285, icon: <VaultIcon size={18} /> },
  { id: "rent", label: "Rent", hue: 35, icon: <HomeIcon size={18} /> },
  { id: "robinhood", label: "Robinhood", hue: 150, icon: <TrendingUp size={18} /> },
  { id: "co", label: "CO", hue: 220, icon: <Landmark size={18} /> },
  { id: "buffer", label: "Buffer", hue: 330, icon: <Sparkles size={18} /> },
];

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="fx-card"
      style={{
        padding: 22,
        height: "100%",
        background: "var(--surface)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius)",
      }}
    >
      {children}
    </div>
  );
}

function SField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          font: "600 11.5px var(--ui)",
          letterSpacing: ".03em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inpStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 11,
  background: "var(--surface-2)",
  border: "1px solid var(--hair)",
  color: "var(--ink-1)",
  font: "500 14px var(--ui)",
  outline: "none",
  fontVariantNumeric: "tabular-nums",
};

function EmployerRow({
  code,
  hue,
  caption,
  children,
}: {
  code: string;
  hue: number;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "12px 13px",
        borderRadius: 11,
        background: "var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            font: "600 13px var(--display)",
            color: "#fff",
            background: `oklch(0.6 0.16 ${hue})`,
            flex: "none",
          }}
        >
          {code}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "600 14px var(--ui)",
              color: "var(--ink-1)",
            }}
          >
            {code}
          </div>
          <div
            style={{
              font: "500 12px var(--ui)",
              color: "var(--ink-3)",
            }}
          >
            {caption}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

type FieldProps = {
  form: SettingsForm;
  name: SettingsFieldName;
  label: string;
  description?: string;
};

function MoneyInput({
  form,
  name,
}: {
  form: SettingsForm;
  name: SettingsFieldName;
}) {
  const value = form.watch(name);
  const numeric = typeof value === "number" ? value : Number(value);
  const display = Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : "";
  return (
    <div style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 13,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--ink-3)",
          font: "600 15px var(--display)",
          pointerEvents: "none",
        }}
      >
        $
      </span>
      <input
        className="inp"
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          const parsed = parseFloat(cleaned);
          form.setValue(name, Number.isFinite(parsed) ? parsed : 0, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        style={{ ...inpStyle, paddingLeft: 24 }}
      />
    </div>
  );
}

function MoneyField({ form, name, label, description }: FieldProps) {
  const error = form.formState.errors[name];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={name}
        style={{
          font: "600 11.5px var(--ui)",
          letterSpacing: ".03em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label} ($)
      </label>
      <Input
        id={name}
        type="number"
        step="0.01"
        inputMode="decimal"
        aria-invalid={!!error}
        {...form.register(name, { valueAsNumber: true })}
      />
      {description && !error && (
        <p
          style={{
            font: "400 11.5px/1.4 var(--ui)",
            color: "var(--ink-3)",
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
      {error?.message && (
        <p
          style={{
            font: "500 11.5px var(--ui)",
            color: "var(--accent-ink)",
            margin: 0,
          }}
        >
          {String(error.message)}
        </p>
      )}
    </div>
  );
}

function IntField({ form, name, label, description }: FieldProps) {
  const error = form.formState.errors[name];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={name}
        style={{
          font: "600 11.5px var(--ui)",
          letterSpacing: ".03em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label}
      </label>
      <Input
        id={name}
        type="number"
        step="1"
        inputMode="numeric"
        aria-invalid={!!error}
        {...form.register(name, { valueAsNumber: true })}
      />
      {description && !error && (
        <p
          style={{
            font: "400 11.5px/1.4 var(--ui)",
            color: "var(--ink-3)",
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
      {error?.message && (
        <p
          style={{
            font: "500 11.5px var(--ui)",
            color: "var(--accent-ink)",
            margin: 0,
          }}
        >
          {String(error.message)}
        </p>
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

  const [localText, setLocalText] = useState<string>(canonicalDisplay);
  const lastSyncedRef = useRef<number>(numericValue);

  useEffect(() => {
    if (numericValue !== lastSyncedRef.current) {
      const parsedLocal = parseFloat(localText);
      const localAsDecimal = Number.isFinite(parsedLocal)
        ? parsedLocal / 100
        : NaN;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={`${name}-display`}
        style={{
          font: "600 11.5px var(--ui)",
          letterSpacing: ".03em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label} (%)
      </label>
      <div style={{ position: "relative" }}>
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
        <span
          style={{
            pointerEvents: "none",
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            font: "500 11.5px var(--ui)",
            color: "var(--ink-3)",
          }}
        >
          %
        </span>
      </div>
      {description && !error && (
        <p
          style={{
            font: "400 11.5px/1.4 var(--ui)",
            color: "var(--ink-3)",
            margin: 0,
          }}
        >
          {description} Stored as {numericValue.toFixed(6)}.
        </p>
      )}
      {error?.message && (
        <p
          style={{
            font: "500 11.5px var(--ui)",
            color: "var(--accent-ink)",
            margin: 0,
          }}
        >
          {String(error.message)}
        </p>
      )}
    </div>
  );
}
