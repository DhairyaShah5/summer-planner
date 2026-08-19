'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { HandCoins, Plus, Trash2, Check, X } from 'lucide-react'
import { fmtMoney, Reveal } from '@/components/redesign'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { upsertLender, deleteLender } from './lender-actions'

export interface LenderRow {
  id: string
  name: string
  principal: number
  outstanding: number
  note: string | null
}

export function LendersManager({ initialRows }: { initialRows: LenderRow[] }) {
  const [rows, setRows] = useState<LenderRow[]>(initialRows)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    name: '',
    principal: '',
    outstanding: '',
    note: '',
  })
  const [pending, startTransition] = useTransition()

  const totalOwed = rows.reduce((s, r) => s + r.outstanding, 0)
  const totalBorrowed = rows.reduce((s, r) => s + r.principal, 0)

  function startAdd() {
    setEditingId('new')
    setDraft({ name: '', principal: '', outstanding: '', note: '' })
  }

  function startEdit(r: LenderRow) {
    setEditingId(r.id)
    setDraft({
      name: r.name,
      principal: String(r.principal),
      outstanding: String(r.outstanding),
      note: r.note ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({ name: '', principal: '', outstanding: '', note: '' })
  }

  function save() {
    const name = draft.name.trim()
    const principal = Number(draft.principal)
    const outstanding = Number(draft.outstanding)
    if (!name) return toast.error('Name required')
    if (!Number.isFinite(principal) || principal < 0) {
      return toast.error('Principal must be a non-negative number')
    }
    if (!Number.isFinite(outstanding) || outstanding < 0) {
      return toast.error('Outstanding must be a non-negative number')
    }
    startTransition(async () => {
      const result = await upsertLender({
        id: editingId === 'new' ? undefined : editingId!,
        name,
        principal,
        outstanding,
        note: draft.note.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to save lender')
        return
      }
      if (editingId === 'new') {
        // Optimistic: id will be resolved on next refresh; we'll drop the temp
        // and let the server-rendered page re-hydrate.
        setRows((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            name,
            principal,
            outstanding,
            note: draft.note.trim() || null,
          },
        ])
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? {
                  ...r,
                  name,
                  principal,
                  outstanding,
                  note: draft.note.trim() || null,
                }
              : r,
          ),
        )
      }
      cancelEdit()
      toast.success('Lender saved')
    })
  }

  function remove(id: string) {
    if (!confirm('Delete this lender?')) return
    startTransition(async () => {
      const result = await deleteLender(id)
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to delete lender')
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success('Lender deleted')
    })
  }

  return (
    <Reveal delay={200}>
      <div
        className="fx-card"
        style={{
          marginTop: 16,
          padding: 22,
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background:
                  'linear-gradient(135deg, rgba(245, 198, 107, 0.20), rgba(138, 111, 224, 0.16))',
                color: 'var(--ink-1)',
              }}
            >
              <HandCoins size={16} strokeWidth={2.2} />
            </div>
            <div>
              <div
                style={{
                  font: '600 12px/1 var(--ui)',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Lenders · money you owe
              </div>
              <div
                style={{
                  font: '500 12.5px/1.4 var(--ui)',
                  color: 'var(--ink-3)',
                  marginTop: 4,
                }}
              >
                {rows.length === 0
                  ? 'None. Add a lender to gate the goal on repayment.'
                  : `${fmtMoney(totalOwed)} outstanding of ${fmtMoney(totalBorrowed)} borrowed`}
              </div>
            </div>
          </div>
          {editingId !== 'new' && (
            <Button
              type="button"
              onClick={startAdd}
              disabled={pending}
              size="sm"
              variant="outline"
            >
              <Plus size={14} />
              Add lender
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 8,
              marginBottom: editingId === 'new' ? 12 : 0,
            }}
          >
            {rows.map((r) =>
              editingId === r.id ? (
                <EditorRow
                  key={r.id}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancelEdit}
                  pending={pending}
                />
              ) : (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--hair)',
                    background: 'var(--surface-2, transparent)',
                  }}
                >
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div
                      style={{
                        font: '600 14px/1.2 var(--ui)',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        font: '500 12px/1.4 var(--ui)',
                        color: 'var(--ink-3)',
                        marginTop: 2,
                      }}
                    >
                      Owe {fmtMoney(r.outstanding)} · borrowed{' '}
                      {fmtMoney(r.principal)}
                      {r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(r)}
                    disabled={pending}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(r.id)}
                    disabled={pending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ),
            )}
          </div>
        )}

        {editingId === 'new' && (
          <EditorRow
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={cancelEdit}
            pending={pending}
          />
        )}
      </div>
    </Reveal>
  )
}

function EditorRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  pending,
}: {
  draft: { name: string; principal: string; outstanding: string; note: string }
  setDraft: (
    d: {
      name: string
      principal: string
      outstanding: string
      note: string
    },
  ) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1.4fr auto',
        gap: 8,
        alignItems: 'end',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px dashed var(--accent, var(--hair))',
        background: 'var(--surface-2, transparent)',
      }}
    >
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ font: '500 11px/1 var(--ui)', color: 'var(--ink-3)' }}>
          Name
        </span>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Yash"
          autoFocus
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ font: '500 11px/1 var(--ui)', color: 'var(--ink-3)' }}>
          Borrowed
        </span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={draft.principal}
          onChange={(e) => setDraft({ ...draft, principal: e.target.value })}
          placeholder="1000"
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ font: '500 11px/1 var(--ui)', color: 'var(--ink-3)' }}>
          Outstanding
        </span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={draft.outstanding}
          onChange={(e) => setDraft({ ...draft, outstanding: e.target.value })}
          placeholder="1000"
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ font: '500 11px/1 var(--ui)', color: 'var(--ink-3)' }}>
          Note (optional)
        </span>
        <Input
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="tuition bridge"
        />
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending}
        >
          <Check size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  )
}
