'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { addExpense } from './expense-actions'

const CATEGORIES = ['Food', 'Transit', 'Entertainment', 'Groceries', 'Other']

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
  const [category, setCategory] = useState('Food')
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? '')
  const [descFocused, setDescFocused] = useState(false)

  useEffect(() => {
    descriptionRef.current?.focus()
  }, [])

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
      setDescription('')
      setAmount('')
      descriptionRef.current?.focus()
      toast.success('Saved')
      router.refresh()
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
    <Card
      className={cn(
        'sticky top-2 z-20 shadow-sm transition-all duration-300 hover:shadow-md',
        descFocused &&
          'ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/10',
      )}
    >
      <CardContent className="py-2">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
                placeholder="Coffee, gas, etc."
                autoComplete="off"
                disabled={pending}
                className={cn(
                  'transition-all duration-300',
                  descFocused && 'ring-1 ring-indigo-400/60',
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                list="expense-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Pick or type"
                autoComplete="off"
                disabled={pending}
              />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account">Account</Label>
            <Select
              value={accountId}
              onValueChange={(v) => setAccountId(String(v))}
              disabled={pending || accounts.length === 0}
            >
              <SelectTrigger id="account" className="w-full">
                <SelectValue placeholder="Pick an account">
                  {(value) => {
                    const acct = accounts.find((a) => a.id === value)
                    return acct ? acct.name : 'Pick an account'
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
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <motion.div key={c} whileTap={{ scale: 0.94 }}>
                <Button
                  type="button"
                  size="xs"
                  variant={category === c ? 'default' : 'outline'}
                  onClick={() => setCategory(c)}
                  disabled={pending}
                  className="transition-colors"
                >
                  {c}
                </Button>
              </motion.div>
            ))}
          </div>
          <motion.div whileTap={{ scale: 0.98 }} className="w-full">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full transition-transform"
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <PlusIcon className="size-4" />
                Add expense
              </>
            )}
          </Button>
          </motion.div>
        </form>
      </CardContent>
    </Card>
    </motion.div>
  )
}
