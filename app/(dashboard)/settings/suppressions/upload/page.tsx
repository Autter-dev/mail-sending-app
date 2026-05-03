"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Target = "skip" | "email" | "reason" | "source"

interface ColumnMapping {
  target: Target
}

interface ImportResult {
  inserted: number
  skipped: number
}

const STEP_LABELS = ["Upload File", "Map Columns", "Import"]

export default function SuppressionsUploadPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<string[][]>([])
  const [s3Key, setS3Key] = useState<string>("")
  const [filename, setFilename] = useState<string>("")

  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const emailMappedIndex = columnMappings.findIndex((m) => m.target === "email")
  const isEmailMapped = emailMappedIndex !== -1

  async function handleFile(file: File) {
    if (!file) return
    setUploadError(null)
    setIsUploading(true)
    setFilename(file.name)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("filename", file.name)

    try {
      const res = await fetch("/api/internal/suppressions/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed")
      }
      const data = await res.json()
      setHeaders(data.headers)
      setPreview(data.preview)
      setS3Key(data.s3Key)

      const initial: ColumnMapping[] = (data.headers as string[]).map((h) => {
        const lc = h.toLowerCase().trim()
        if (lc === "email") return { target: "email" }
        if (lc === "reason") return { target: "reason" }
        if (lc === "source") return { target: "source" }
        return { target: "skip" }
      })
      setColumnMappings(initial)
      setStep(2)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "An error occurred during upload")
    } finally {
      setIsUploading(false)
    }
  }

  function updateMapping(index: number, target: Target) {
    setColumnMappings((prev) => {
      const next = [...prev]
      next[index] = { target }
      return next
    })
  }

  async function handleImport() {
    setIsImporting(true)
    setImportError(null)
    setImportProgress(20)

    let emailColumn: number | undefined
    let reasonColumn: number | undefined
    let sourceColumn: number | undefined
    columnMappings.forEach((m, i) => {
      if (m.target === "email") emailColumn = i
      else if (m.target === "reason") reasonColumn = i
      else if (m.target === "source") sourceColumn = i
    })

    if (emailColumn === undefined) {
      setImportError("Email column is required")
      setIsImporting(false)
      return
    }

    const mapping: Record<string, number> = { email: emailColumn }
    if (reasonColumn !== undefined) mapping.reason = reasonColumn
    if (sourceColumn !== undefined) mapping.source = sourceColumn

    setImportProgress(50)

    try {
      const res = await fetch("/api/internal/suppressions/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key, filename, mapping }),
      })
      setImportProgress(85)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Import failed")
      }
      const result = (await res.json()) as ImportResult
      setImportProgress(100)
      setImportResult(result)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "An error occurred during import")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? "\u2713" : stepNum}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-1">Upload a suppression file</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Accepted formats: CSV and XLSX. The first row must be a header row. Required column: email.
              Optional: reason, source.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) handleFile(file)
              }}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              {isUploading ? (
                <p className="text-sm text-muted-foreground">Uploading file...</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.csv and .xlsx files only</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />

            {uploadError && (
              <p className="mt-4 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                {uploadError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-1">Preview</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Showing the first {preview.length} rows from your file.
              </p>
              <div className="overflow-x-auto rounded border">
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
                          <TableCell key={ci} className="text-xs text-muted-foreground whitespace-nowrap">
                            {cell ?? ""}
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
              <p className="text-sm text-muted-foreground mb-5">
                Email is required. Reason values must be one of: bounce, complaint, unsubscribe,
                manual, imported. Other values default to imported.
              </p>

              <div className="space-y-3">
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {header}
                      </span>
                    </div>
                    <div className="w-44 shrink-0">
                      <Select
                        value={columnMappings[i]?.target ?? "skip"}
                        onValueChange={(val) => updateMapping(i, val as Target)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="reason">Reason</SelectItem>
                          <SelectItem value="source">Source</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {!isEmailMapped && (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2">
                  Please map one column to Email before importing.
                </p>
              )}

              <div className="flex items-center gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  onClick={() => { setStep(3); handleImport() }}
                  disabled={!isEmailMapped}
                >
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Importing suppressions</h2>

            {isImporting && (
              <div className="space-y-3">
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Processing your file, please wait...
                </p>
              </div>
            )}

            {importError && (
              <div className="space-y-4">
                <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                  {importError}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>Back to Mapping</Button>
                  <Button onClick={() => { setImportError(null); setImportProgress(0); handleImport() }}>
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {importResult && !isImporting && (
              <div className="space-y-6">
                <Progress value={100} className="h-2" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {importResult.inserted}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Inserted</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">
                      {importResult.skipped}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Skipped</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import complete. Skipped entries were either invalid emails or already on the list.
                </p>
                <Button onClick={() => router.push("/settings/suppressions")}>
                  Back to Suppressions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
