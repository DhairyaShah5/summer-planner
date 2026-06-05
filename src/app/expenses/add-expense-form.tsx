'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const CATEGORIES = ['Food', 'Transit', 'Entertainment', 'Groceries', 'Other']

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

interface NewExpense {
  expense_date: string
  description: string
  amount: number
  category: string
}

export function AddExpenseForm() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const descriptionRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [descFocused, setDescFocused] = useState(false)

  useEffect(() => {
    descriptionRef.current?.focus()
  }, [])

  const mutation = useMutation({
    mutationFn: async (e: NewExpense) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        expense_date: e.expense_date,
        description: e.description,
        amount: e.amount,
        category: e.category || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      router.refresh()
      setDescription('')
      setAmount('')
      descriptionRef.current?.focus()
      toast.success('Saved')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not add expense')
    },
  })

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
    mutation.mutate({
      expense_date: date,
      description: desc,
      amount: amt,
      category: category.trim(),
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
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
              />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <motion.div key={c} whileTap={{ scale: 0.94 }}>
                <Button
                  type="button"
                  size="xs"
                  variant={category === c ? 'default' : 'outline'}
                  onClick={() => setCategory(c)}
                  disabled={mutation.isPending}
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
            disabled={mutation.isPending}
            className="w-full transition-transform"
          >
            {mutation.isPending ? (
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
