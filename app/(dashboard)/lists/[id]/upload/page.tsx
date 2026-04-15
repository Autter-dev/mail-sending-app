"use client"
import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type MappingTarget =
  | 'skip'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'custom'

interface ColumnMapping {
  target: MappingTarget
  customKey: string
}

interface UploadResult {
  inserted: number
  updated: number
  skipped: number
}

const STEP_LABELS = ['Upload File', 'Map Columns', 'Import']

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Data from step 1
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<string[][]>([])
  const [s3Key, setS3Key] = useState<string>('')

  // Data from step 2
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])

  // Data from step 3
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<UploadResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derived: check if email is mapped
  const emailMappedIndex = columnMappings.findIndex((m) => m.target === 'email')
  const isEmailMapped = emailMappedIndex !== -1

  // Step 1: handle file selection
  async function handleFile(file: File) {
    if (!file) return
    setUploadError(null)
    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/internal/lists/${listId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }

      const data = await res.json()
      setHeaders(data.headers)
      setPreview(data.preview)
      setS3Key(data.s3Key)

      // Initialize column mappings (all set to skip by default)
      setColumnMappings(
        (data.headers as string[]).map(() => ({ target: 'skip' as MappingTarget, customKey: '' }))
      )

      setStep(2)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred during upload')
    } finally {
      setIsUploading(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click()
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // Step 2: update a single column mapping
  function updateMappingTarget(index: number, target: MappingTarget) {
    setColumnMappings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], target }
      return next
    })
  }

  function updateMappingCustomKey(index: number, key: string) {
    setColumnMappings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], customKey: key }
      return next
    })
  }

  // Step 3: run the import
  async function handleImport() {
    setIsImporting(true)
    setImportError(null)
    setImportProgress(10)

    // Build the mapping payload
    let emailColumn: number | undefined
    let firstNameColumn: number | undefined
    let lastNameColumn: number | undefined
    const metadataColumns: { column: number; key: string }[] = []

    columnMappings.forEach((m, i) => {
      if (m.target === 'email') emailColumn = i
      else if (m.target === 'firstName') firstNameColumn = i
      else if (m.target === 'lastName') lastNameColumn = i
      else if (m.target === 'custom' && m.customKey.trim()) {
        metadataColumns.push({ column: i, key: m.customKey.trim() })
      }
    })

    if (emailColumn === undefined) {
      setImportError('Email column is required')
      setIsImporting(false)
      return
    }

    const mapping: Record<string, unknown> = { email: emailColumn }
    if (firstNameColumn !== undefined) mapping.firstName = firstNameColumn
    if (lastNameColumn !== undefined) mapping.lastName = lastNameColumn
    if (metadataColumns.length > 0) mapping.metadata = metadataColumns

    setImportProgress(30)

    try {
      const res = await fetch(`/api/internal/lists/${listId}/upload/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key, mapping }),
      })

      setImportProgress(80)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Import failed')
      }

      const result = await res.json()
      setImportProgress(100)
      setImportResult(result)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'An error occurred during import')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3
          const isActive = step === stepNum
          const isDone = step > stepNum
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold border-2 transition-colors ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isDone
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300 text-slate-400'
                }`}
              >
                {isDone ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className="w-8 h-px bg-slate-200 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: File Upload */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-1">Upload a contacts file</h2>
            <p className="text-sm text-slate-500 mb-6">
              Accepted formats: CSV and XLSX. The first row must be a header row.
            </p>

            <div
              onClick={handleDropZoneClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <svg
                className="w-10 h-10 text-slate-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {isUploading ? (
                <p className="text-sm text-slate-500">Uploading file...</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-slate-400 mt-1">.csv and .xlsx files only</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {uploadError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {uploadError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-1">Preview</h2>
              <p className="text-sm text-slate-500 mb-4">
                Showing the first {preview.length} rows from your file.
              </p>
              <div className="overflow-x-auto rounded border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="whitespace-nowrap text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className="text-xs text-slate-600 whitespace-nowrap">
                            {cell ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-1">Map columns</h2>
              <p className="text-sm text-slate-500 mb-5">
                Assign each column to a field. The Email column is required.
              </p>

              <div className="space-y-3">
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <span className="text-sm font-medium text-slate-700 truncate block">
                        {header}
                      </span>
                    </div>
                    <div className="w-44 shrink-0">
                      <Select
                        value={columnMappings[i]?.target ?? 'skip'}
                        onValueChange={(val) =>
                          updateMappingTarget(i, val as MappingTarget)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="firstName">First Name</SelectItem>
                          <SelectItem value="lastName">Last Name</SelectItem>
                          <SelectItem value="custom">Custom Field</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {columnMappings[i]?.target === 'custom' && (
                      <Input
                        className="h-8 text-sm w-44"
                        placeholder="Metadata key name"
                        value={columnMappings[i]?.customKey ?? ''}
                        onChange={(e) => updateMappingCustomKey(i, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {!isEmailMapped && (
                <p className="mt-4 text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
                  Please map one column to Email before importing.
                </p>
              )}

              <div className="flex items-center gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setStep(3)
                    handleImport()
                  }}
                  disabled={!isEmailMapped}
                >
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Confirmation and progress */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Importing contacts</h2>

            {isImporting && (
              <div className="space-y-3">
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-slate-500">
                  Processing your file, please wait...
                </p>
              </div>
            )}

            {importError && (
              <div className="space-y-4">
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                  {importError}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back to Mapping
                  </Button>
                  <Button
                    onClick={() => {
                      setImportError(null)
                      setImportProgress(0)
                      handleImport()
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {importResult && !isImporting && (
              <div className="space-y-6">
                <Progress value={100} className="h-2" />

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {importResult.inserted}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Inserted</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {importResult.updated}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Updated</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 text-center">
                    <p className="text-2xl font-bold text-slate-500">
                      {importResult.skipped}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Skipped</p>
                  </div>
                </div>

                <p className="text-sm text-slate-600">
                  Import complete. Your contacts have been added to the list.
                </p>

                <Button onClick={() => router.push(`/lists/${listId}`)}>
                  Back to List
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
