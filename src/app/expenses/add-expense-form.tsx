'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

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
  const descriptionRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')

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
    <Card className="sticky top-2 z-20 shadow-sm">
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Coffee, gas, etc."
                autoComplete="off"
                disabled={mutation.isPending}
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
              <Button
                key={c}
                type="button"
                size="xs"
                variant={category === c ? 'default' : 'outline'}
                onClick={() => setCategory(c)}
                disabled={mutation.isPending}
              >
                {c}
              </Button>
            ))}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={mutation.isPending}
            className="w-full"
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
        </form>
      </CardContent>
    </Card>
  )
}
