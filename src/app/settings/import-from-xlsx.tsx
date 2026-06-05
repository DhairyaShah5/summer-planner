'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { importFromXlsx } from './import-actions'
import { parseWorkbook, type ParsedWorkbook } from './import-parse'

type PreviewState = {
  file: File
  parsed: ParsedWorkbook
}

export function ImportFromXlsx() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const previewMutation = useMutation({
    mutationFn: async (selectedFile: File): Promise<PreviewState> => {
      const buf = await selectedFile.arrayBuffer()
      const parsed = parseWorkbook(buf)
      return { file: selectedFile, parsed }
    },
    onSuccess: (state) => {
      setPreview(state)
      setDialogOpen(true)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to read workbook')
    },
  })

  const importMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const result = await importFromXlsx(fd)
      if (!result.ok) {
        throw new Error(result.error || 'Import failed')
      }
      return result
    },
    onSuccess: (result) => {
      toast.success(
        `Imported settings and ${result.paychecksImported} paycheck${
          result.paychecksImported === 1 ? '' : 's'
        }`,
      )
      setDialogOpen(false)
      setPreview(null)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['paychecks'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Import failed')
    },
  })

  const pending = previewMutation.isPending || importMutation.isPending

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setPreview(null)
  }

  const handlePreview = () => {
    if (!file) {
      toast.error('Choose an .xlsx file first')
      return
    }
    previewMutation.mutate(file)
  }

  const handleConfirm = () => {
    if (!preview) return
    importMutation.mutate(preview.file)
  }

  const handleDialogChange = (open: boolean) => {
    if (importMutation.isPending) return
    setDialogOpen(open)
    if (!open) {
      setPreview(null)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="xlsx-file">Workbook file</Label>
          <Input
            id="xlsx-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Select your Summer 2026 Net Paycheck Allocation Planner spreadsheet.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={handlePreview}
            disabled={pending || !file}
          >
            {previewMutation.isPending ? 'Reading...' : 'Preview'}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm import</DialogTitle>
            <DialogDescription>
              This will overwrite your existing settings and replace all your
              paychecks.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">Will import:</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>1 settings row</li>
                  <li>
                    {preview.parsed.paychecks.length} paycheck
                    {preview.parsed.paychecks.length === 1 ? '' : 's'}
                  </li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Vault cap</span>
                <span className="text-right tabular-nums">
                  ${preview.parsed.settings.vault_cap.toLocaleString()}
                </span>
                <span className="text-muted-foreground">Rent monthly</span>
                <span className="text-right tabular-nums">
                  ${preview.parsed.settings.rent_monthly.toLocaleString()}
                </span>
                <span className="text-muted-foreground">USC gross baseline</span>
                <span className="text-right tabular-nums">
                  ${preview.parsed.settings.usc_gross_baseline.toLocaleString()}
                </span>
                <span className="text-muted-foreground">NTT hourly rate</span>
                <span className="text-right tabular-nums">
                  ${preview.parsed.settings.ntt_hourly_rate.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Existing paychecks for your account will be deleted before the
                new rows are inserted.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={importMutation.isPending || !preview}
            >
              {importMutation.isPending ? 'Importing...' : 'Confirm import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
