"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { fieldsConfig } from "./fields-config"
import { useState, useMemo } from "react"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Search,
  Copy,
  Check,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"

function createSchema(fields: typeof fieldsConfig) {
  const schemaObject = fields.reduce(
    (acc, field) => {
      acc[field.id] = z.string().min(1, `${field.label} est requis`)
      return acc
    },
    {} as Record<string, z.ZodString>
  )
  return z.object(schemaObject)
}

type FormData = z.infer<ReturnType<typeof createSchema>>

export function PromptForm() {
  const schema = createSchema(fieldsConfig)
  const [fieldValidations, setFieldValidations] = useState<
    Record<string, boolean | null>
  >({})
  const [submittingFields, setSubmittingFields] = useState<
    Record<string, boolean>
  >({})
  const [openFields, setOpenFields] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) {
      return fieldsConfig
    }

    const query = searchQuery.toLowerCase().trim()
    return fieldsConfig.filter(
      (field) =>
        field.label.toLowerCase().includes(query) ||
        field.id.toLowerCase().includes(query) ||
        field.fieldId.toLowerCase().includes(query) ||
        field.section.toLowerCase().includes(query) ||
        field.content.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof fieldsConfig> = {}
    filteredFields.forEach((field) => {
      if (!groups[field.section]) {
        groups[field.section] = []
      }
      groups[field.section].push(field)
    })
    return groups
  }, [filteredFields])

  const sections = useMemo(() => {
    const sectionSet = new Set(filteredFields.map((f) => f.section))
    return Array.from(sectionSet)
  }, [filteredFields])

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: fieldsConfig.reduce(
      (acc, field) => {
        acc[field.id] = field.content
        return acc
      },
      {} as Record<string, string>
    ),
  })

  async function validateField(fieldId: string) {
    setSubmittingFields((prev) => ({ ...prev, [fieldId]: true }))

    const isValid = await trigger(fieldId as keyof FormData)
    setFieldValidations((prev) => ({
      ...prev,
      [fieldId]: isValid,
    }))

    if (isValid) {
      const fieldValue = getValues(fieldId as keyof FormData)
      console.log(`Field ${fieldId} submitted:`, fieldValue)
      // Here you can add your submission logic for this specific field
    }

    // Simulate async submission
    setTimeout(() => {
      setSubmittingFields((prev) => ({ ...prev, [fieldId]: false }))
    }, 500)
  }

  function copyToClipboard(text: string, fieldId: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(fieldId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un prompt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green dark:bg-[#343541] dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
        />
        {searchQuery && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
            {filteredFields.length} résultat
            {filteredFields.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {filteredFields.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#40414f] rounded-2xl border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            Aucun prompt trouvé pour &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <>
          {sections.map((section) => {
            const sectionFields = groupedFields[section]
            if (!sectionFields || sectionFields.length === 0) return null

            return (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-3 pt-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {sectionFields[0].label.split(" - ")[0]}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({sectionFields.length} prompt
                    {sectionFields.length > 1 ? "s" : ""})
                  </span>
                </div>
                {sectionFields.map((field) => {
                  const fieldError = errors[field.id as keyof FormData]
                  const isValid = fieldValidations[field.id]
                  const isSubmitting = submittingFields[field.id]
                  const isOpen = openFields[field.id] ?? false

                  return (
                    <div key={field.id} className="isolate">
                      <Collapsible
                        id={`collapsible-${field.id}`}
                        open={isOpen}
                        onOpenChange={(open) => {
                          setOpenFields((prev) => ({
                            ...prev,
                            [field.id]: open,
                          }))
                        }}
                        className="group relative bg-white dark:bg-[#40414f] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-4 p-6 relative">
                          <CollapsibleTrigger className="flex items-center gap-4 flex-1 min-w-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-l-2xl -ml-6 -mr-4 -my-6 px-6 py-6 relative z-10">
                            <ChevronDown
                              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <label
                                htmlFor={field.id}
                                className="text-base font-semibold text-gray-900 dark:text-gray-100 cursor-pointer pointer-events-none"
                              >
                                {field.label}
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-shrink-0 pointer-events-none">
                                ID: {field.fieldId}
                              </span>
                              {isValid === true && (
                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 pointer-events-none" />
                              )}
                              {isValid === false && (
                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 pointer-events-none" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                copyToClipboard(field.fieldId, field.id)
                              }}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex items-center justify-center cursor-pointer"
                              aria-label="Copier l'ID"
                              title="Copier l'ID"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  copyToClipboard(field.fieldId, field.id)
                                }
                              }}
                            >
                              {copiedId === field.id ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                if (!isSubmitting) {
                                  validateField(field.id)
                                }
                              }}
                              className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                                isSubmitting
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              } ${
                                isValid === true
                                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                                  : isValid === false
                                    ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                              }`}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (
                                  (e.key === "Enter" || e.key === " ") &&
                                  !isSubmitting
                                ) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  validateField(field.id)
                                }
                              }}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Validation...</span>
                                </>
                              ) : isValid === true ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Valide</span>
                                </>
                              ) : isValid === false ? (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  <span>Invalide</span>
                                </>
                              ) : (
                                <span>Valider</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <CollapsibleContent className="overflow-hidden px-6 pb-6 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                          <div className="pt-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="relative">
                              <textarea
                                id={field.id}
                                {...register(field.id as keyof FormData)}
                                rows={30}
                                className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 dark:bg-[#343541] dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y ${
                                  fieldError
                                    ? "border-red-400 focus:ring-red-500/50 focus:border-red-500 bg-red-50/50 dark:bg-red-900/10"
                                    : isValid === true
                                      ? "border-green-400 focus:ring-green-500/50 focus:border-green-500 bg-green-50/30 dark:bg-green-900/10"
                                      : "border-gray-300 dark:border-gray-600 focus:ring-brand-green/50 focus:border-brand-green hover:border-gray-400 dark:hover:border-gray-500"
                                }`}
                                placeholder={`Saisissez le contenu pour ${field.label.toLowerCase()}...`}
                              />
                              {fieldError && (
                                <div className="mt-2 flex items-start gap-2">
                                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-red-600 dark:text-red-400">
                                    {fieldError.message}
                                  </p>
                                </div>
                              )}
                              {isValid === true && !fieldError && (
                                <div className="mt-2 flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    Champ valide et soumis avec succès
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
