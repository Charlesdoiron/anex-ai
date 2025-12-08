"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ChevronDown,
  Search,
  RotateCcw,
  Play,
  Check,
  X,
  Loader2,
  AlertCircle,
  Copy,
  Pencil,
  FlaskConical,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"

interface PromptWithMetadata {
  section: string
  label: string
  currentPrompt: string
  defaultPrompt: string
  isOverridden: boolean
  retryable: boolean
  updatedAt?: string
  updatedBy?: string
}

interface TestDocument {
  id: string
  name: string
  path: string
}

interface TestResult {
  field: string
  expected: unknown
  actual: unknown
  passed: boolean
  tolerance: string
  comment?: string
}

interface TestComparison {
  passed: number
  failed: number
  total: number
  details: TestResult[]
}

interface SectionGroups {
  [groupName: string]: Array<{ section: string; label: string }>
}

export function PromptFormWithTest() {
  const [prompts, setPrompts] = useState<PromptWithMetadata[]>([])
  const [sectionGroups, setSectionGroups] = useState<SectionGroups>({})
  const [testDocuments, setTestDocuments] = useState<TestDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [testingSection, setTestingSection] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<string>("")
  const [testResults, setTestResults] = useState<
    Record<string, TestComparison>
  >({})
  const [savingSection, setSavingSection] = useState<string | null>(null)

  const fetchPrompts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prompts")
      if (!response.ok) {
        throw new Error("Failed to fetch prompts")
      }
      const data = await response.json()
      setPrompts(data.prompts)
      setSectionGroups(data.sectionGroups)
      setTestDocuments(data.testDocuments)
      if (data.testDocuments.length > 0 && !selectedDocument) {
        setSelectedDocument(data.testDocuments[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [selectedDocument])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const getPromptForSection = useCallback(
    (section: string) => prompts.find((p) => p.section === section),
    [prompts]
  )

  const filteredGroups = useMemo(() => {
    return Object.entries(sectionGroups).reduce(
      (acc, [groupName, sections]) => {
        const filtered = sections.filter((s) => {
          const prompt = getPromptForSection(s.section)
          if (!prompt) return false
          if (!searchQuery) return true
          const query = searchQuery.toLowerCase()
          return (
            s.label.toLowerCase().includes(query) ||
            s.section.toLowerCase().includes(query) ||
            prompt.currentPrompt.toLowerCase().includes(query)
          )
        })
        if (filtered.length > 0) {
          acc[groupName] = filtered
        }
        return acc
      },
      {} as SectionGroups
    )
  }, [sectionGroups, searchQuery, getPromptForSection])

  const startEditing = (prompt: PromptWithMetadata) => {
    setEditingSection(prompt.section)
    setEditedPrompt(prompt.currentPrompt)
    setOpenSections((prev) => ({ ...prev, [prompt.section]: true }))
  }

  const cancelEditing = () => {
    setEditingSection(null)
    setEditedPrompt("")
  }

  const savePrompt = async (section: string) => {
    setSavingSection(section)
    try {
      const response = await fetch(`/api/admin/prompts/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editedPrompt }),
      })

      if (!response.ok) {
        throw new Error("Failed to save prompt")
      }

      await fetchPrompts()
      setEditingSection(null)
      setEditedPrompt("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingSection(null)
    }
  }

  const resetPrompt = async (section: string) => {
    if (!confirm("Réinitialiser ce prompt à sa valeur par défaut ?")) {
      return
    }

    setSavingSection(section)
    try {
      const response = await fetch(`/api/admin/prompts/${section}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to reset prompt")
      }

      await fetchPrompts()
      setEditingSection(null)
      setEditedPrompt("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset")
    } finally {
      setSavingSection(null)
    }
  }

  const runTest = async (section: string, promptOverride?: string) => {
    if (!selectedDocument) return

    setTestingSection(section)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[section]
      return next
    })

    try {
      const response = await fetch("/api/admin/prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          documentId: selectedDocument,
          promptOverride,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Test failed")
      }

      const data = await response.json()
      setTestResults((prev) => ({ ...prev, [section]: data.comparison }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingSection(null)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—"
    if (typeof value === "string") return value || "—"
    if (typeof value === "boolean") return value ? "Oui" : "Non"
    if (typeof value === "number") return String(value)
    return JSON.stringify(value, null, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 underline mt-1"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Search and test document selector */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green bg-white text-gray-900 placeholder-gray-400"
          />
          {searchQuery && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {Object.values(filteredGroups).flat().length} résultat
              {Object.values(filteredGroups).flat().length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
          <FlaskConical className="w-5 h-5 text-brand-green" />
          <label className="text-sm text-gray-600 whitespace-nowrap">
            Document de test :
          </label>
          <select
            value={selectedDocument}
            onChange={(e) => setSelectedDocument(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green bg-white text-gray-900 text-sm"
          >
            {testDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {Object.values(filteredGroups).flat().length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            Aucun prompt trouvé pour &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        Object.entries(filteredGroups).map(([groupName, sections]) => (
          <div key={groupName} className="space-y-3">
            <div className="flex items-center gap-3 pt-4 pb-2 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{groupName}</h2>
              <span className="text-sm text-gray-500">
                ({sections.length} prompt{sections.length > 1 ? "s" : ""})
              </span>
            </div>

            {sections.map(({ section, label }) => {
              const prompt = getPromptForSection(section)
              if (!prompt) return null

              const isOpen = openSections[section] ?? false
              const isEditing = editingSection === section
              const isTesting = testingSection === section
              const isSaving = savingSection === section
              const testResult = testResults[section]

              return (
                <div key={section}>
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(open) =>
                      setOpenSections((prev) => ({ ...prev, [section]: open }))
                    }
                    className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1 min-w-0">
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {label}
                          </span>
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {section}
                          </span>
                          {prompt.isOverridden && (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              modifié
                            </span>
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <div
                        className="flex items-center gap-1.5 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Copy ID */}
                        <button
                          onClick={() => copyToClipboard(section, section)}
                          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                          title="Copier l'ID"
                        >
                          {copiedId === section ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>

                        {/* Test button */}
                        <button
                          onClick={() =>
                            runTest(
                              section,
                              isEditing ? editedPrompt : undefined
                            )
                          }
                          disabled={isTesting || !selectedDocument}
                          className="p-1.5 text-gray-500 hover:text-brand-green hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                          title="Tester ce prompt"
                        >
                          {isTesting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => startEditing(prompt)}
                          className="p-1.5 text-gray-500 hover:text-brand-green hover:bg-gray-100 rounded-md transition-colors"
                          title="Modifier ce prompt"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Reset button */}
                        {prompt.isOverridden && (
                          <button
                            onClick={() => resetPrompt(section)}
                            disabled={isSaving}
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                            title="Réinitialiser à la valeur par défaut"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100">
                        {isEditing ? (
                          <>
                            <textarea
                              value={editedPrompt}
                              onChange={(e) => setEditedPrompt(e.target.value)}
                              rows={25}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green bg-white text-gray-900 font-mono text-sm resize-y"
                            />
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() =>
                                  setEditedPrompt(prompt.defaultPrompt)
                                }
                                className="text-sm text-gray-600 hover:text-brand-green transition-colors underline underline-offset-2"
                              >
                                Restaurer le prompt par défaut
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={cancelEditing}
                                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  Annuler
                                </button>
                                <button
                                  onClick={() => runTest(section, editedPrompt)}
                                  disabled={isTesting}
                                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {isTesting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                  Tester
                                </button>
                                <button
                                  onClick={() => savePrompt(section)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 text-sm bg-brand-green text-white rounded-md hover:bg-brand-green/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <pre className="p-4 bg-gray-50 rounded-md text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto border border-gray-200">
                            {prompt.currentPrompt}
                          </pre>
                        )}

                        {/* Test results */}
                        {testResult && testResult.details.length > 0 && (
                          <div className="border-t border-gray-200 pt-4">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                              <FlaskConical className="w-4 h-4 text-brand-green" />
                              Résultats du test
                            </h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {testResult.details.map((detail, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-md text-sm border bg-gray-50 border-gray-200"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <span className="font-mono text-gray-800 text-xs">
                                      {detail.field}
                                    </span>
                                    <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                      {detail.tolerance}
                                    </span>
                                  </div>

                                  {/* Always show values */}
                                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <span className="text-gray-500 font-medium">
                                        Attendu :
                                      </span>
                                      <div className="mt-1 text-gray-800 bg-white p-2 rounded border border-gray-200 overflow-auto max-h-20 font-mono">
                                        {formatValue(detail.expected)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 font-medium">
                                        Obtenu :
                                      </span>
                                      <div className="mt-1 p-2 rounded border overflow-auto max-h-20 font-mono text-gray-800 bg-white border-gray-200">
                                        {formatValue(detail.actual)}
                                      </div>
                                    </div>
                                  </div>

                                  {detail.comment && (
                                    <p className="mt-2 text-xs text-gray-500 italic">
                                      💡 {detail.comment}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
