/**
 * User-friendly labels for all status codes displayed during extraction and chat.
 * Designed for non-technical users.
 */

interface StatusLabel {
  label: string
  description: string
}

const STATUS_LABELS: Record<string, StatusLabel> = {
  // Extraction flow statuses
  pending: {
    label: "En attente",
    description: "Préparation de l'analyse...",
  },
  uploading: {
    label: "Envoi",
    description: "Envoi du document en cours...",
  },
  parsing_pdf: {
    label: "Lecture",
    description: "Lecture du document PDF...",
  },
  extracting_regime: {
    label: "Type de bail",
    description: "Identification du régime juridique...",
  },
  extracting_parties: {
    label: "Parties",
    description: "Identification du bailleur et du preneur...",
  },
  extracting_premises: {
    label: "Locaux",
    description: "Analyse de la description des locaux...",
  },
  extracting_calendar: {
    label: "Dates",
    description: "Extraction des dates clés du bail...",
  },
  extracting_support_measures: {
    label: "Mesures",
    description: "Recherche des mesures d'accompagnement...",
  },
  extracting_rent: {
    label: "Loyer",
    description: "Extraction des montants de loyer...",
  },
  extracting_indexation: {
    label: "Indexation",
    description: "Analyse des clauses d'indexation...",
  },
  extracting_taxes: {
    label: "Impôts",
    description: "Extraction des informations fiscales...",
  },
  extracting_charges: {
    label: "Charges",
    description: "Analyse des provisions pour charges...",
  },
  extracting_insurance: {
    label: "Assurances",
    description: "Recherche des clauses d'assurance...",
  },
  extracting_securities: {
    label: "Garanties",
    description: "Extraction des sûretés et dépôts...",
  },
  extracting_inventory: {
    label: "États des lieux",
    description: "Analyse des conditions d'état des lieux...",
  },
  extracting_maintenance: {
    label: "Travaux",
    description: "Répartition des travaux et entretien...",
  },
  extracting_restitution: {
    label: "Restitution",
    description: "Conditions de remise des locaux...",
  },
  extracting_transfer: {
    label: "Cession",
    description: "Clauses de cession et sous-location...",
  },
  extracting_environmental: {
    label: "Environnement",
    description: "Diagnostics et annexes environnementales...",
  },
  extracting_other_annexes: {
    label: "Annexes",
    description: "Analyse des documents annexés...",
  },
  extracting_other: {
    label: "Autres clauses",
    description: "Extraction des clauses diverses...",
  },
  validating: {
    label: "Vérification",
    description: "Validation des données extraites...",
  },
  completed: {
    label: "Terminé",
    description: "Extraction terminée avec succès.",
  },
  failed: {
    label: "Erreur",
    description: "Une erreur est survenue.",
  },

  // RAG chat statuses
  rag_searching: {
    label: "Recherche",
    description: "Recherche dans le document...",
  },
  rag_results: {
    label: "Résultats",
    description: "Passages pertinents trouvés.",
  },
  error: {
    label: "Erreur",
    description: "Impossible de récupérer le document.",
  },

  // Processing statuses
  processing: {
    label: "Traitement",
    description: "Traitement en cours...",
  },
}

export function getStatusLabel(status: string): StatusLabel {
  // Normalize for lookup (e.g., "extracting_regime" -> "extracting_regime")
  const normalized = status.toLowerCase().replace(/\s+/g, "_")

  if (STATUS_LABELS[normalized]) {
    return STATUS_LABELS[normalized]
  }

  // If status already looks like a user-friendly message (contains spaces,
  // starts with uppercase or emoji), return as-is
  if (isUserFriendlyMessage(status)) {
    return {
      label: "En cours",
      description: status,
    }
  }

  // Fallback: humanize technical status codes
  const humanized = status
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()

  return {
    label: "En cours",
    description: humanized.charAt(0).toUpperCase() + humanized.slice(1) + "...",
  }
}

function isUserFriendlyMessage(status: string): boolean {
  // Already a sentence (has spaces and doesn't look like a snake_case code)
  if (status.includes(" ") && !status.includes("_")) {
    return true
  }

  // Starts with emoji
  if (/^[\u{1F300}-\u{1F9FF}]/u.test(status)) {
    return true
  }

  // Has punctuation typical of messages
  if (status.includes("...") || status.includes(":") || status.endsWith("!")) {
    return true
  }

  return false
}

export function getStatusDescription(status: string): string {
  return getStatusLabel(status).description
}
