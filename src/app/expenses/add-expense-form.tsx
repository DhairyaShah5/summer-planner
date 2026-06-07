'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CatDot } from '@/components/redesign'
import { addExpense } from './expense-actions'
import { EXPENSE_CATEGORIES } from './categories'

export type AccountOptionType = 'checking' | 'credit_card' | 'hysa'

export interface AccountOption {
  id: string
  name: string
  type: AccountOptionType
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

const fieldLabel: React.CSSProperties = {
  font: '600 11.5px var(--ui)',
  letterSpacing: '.03em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

interface Props {
  accounts: AccountOption[]
  defaultAccountId: string | null
}

export function AddExpenseForm({ accounts, defaultAccountId }: Props) {
  const router = useRouter()
  const descriptionRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].id)
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? '')

  useEffect(() => {
    descriptionRef.current?.focus()
  }, [])

  const valid = parseFloat(amount) > 0 && description.trim().length > 0

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const desc = description.trim()
    const amt = parseFloat(amount)
    if (!desc) {
      toast.error('Description required')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!accountId) {
      toast.error('Pick an account')
      return
    }

    startTransition(async () => {
      const res = await addExpense({
        expense_date: date,
        description: desc,
        amount: amt,
        category: category.trim(),
        account_id: accountId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add expense')
        return
      }
      toast.success(`Added $${amt.toFixed(2)} · ${category}`)
      setDescription('')
      setAmount('')
      descriptionRef.current?.focus()
      router.refresh()
    })
  }

  return (
    <Card
      className="mb-4"
      style={{
        padding: 22,
        borderColor: 'color-mix(in oklch, var(--accent) 32%, var(--hair))',
      }}
    >
      <CardContent style={{ padding: 0 }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Description</span>
              <Input
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Coffee, gas, etc."
                autoComplete="off"
                disabled={pending}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Amount</span>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--ink-3)',
                    font: '600 15px var(--display)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  $
                </span>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  disabled={pending}
                  style={{ paddingLeft: 25 }}
                />
              </div>
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 1fr',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Date</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Category</span>
              <Select
                value={category}
                onValueChange={(v) => setCategory(String(v))}
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a category">
                    {(value) => {
                      const c = EXPENSE_CATEGORIES.find((x) => x.id === value)
                      return c ? c.id : 'Pick a category'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={fieldLabel}>Account</span>
              <Select
                value={accountId}
                onValueChange={(v) => setAccountId(String(v))}
                disabled={pending || accounts.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick an account">
                    {(value) => {
                      const a = accounts.find((x) => x.id === value)
                      return a ? a.name : 'Pick an account'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: 7,
              marginBottom: 16,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 2,
            }}
          >
            {EXPENSE_CATEGORIES.map((c) => {
              const active = category === c.id
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  disabled={pending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 999,
                    cursor: pending ? 'not-allowed' : 'pointer',
                    font: '600 11.5px var(--ui)',
                    whiteSpace: 'nowrap',
                    flex: 'none',
                    border: '1px solid',
                    borderColor: active
                      ? `oklch(0.62 0.2 ${c.hue})`
                      : 'var(--hair)',
                    background: active
                      ? `color-mix(in oklch, oklch(0.68 0.2 ${c.hue}) 20%, transparent)`
                      : 'var(--surface)',
                    color: active
                      ? `oklch(0.72 0.2 ${c.hue})`
                      : 'var(--ink-2)',
                    transition: 'all .15s',
                  }}
                >
                  <CatDot hue={c.hue} size={8} />
                  {c.id}
                </button>
              )
            })}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending || !valid}
            className="w-full"
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add expense
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
