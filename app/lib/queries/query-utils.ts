import { BailQuery, bailQueries } from "./bail-queries"

/**
 * Récupère une query par son ID
 */
export function getQueryById(id: string): BailQuery | undefined {
  return bailQueries.find((q) => q.id === id)
}

/**
 * Récupère plusieurs queries par leurs IDs
 */
export function getQueriesByIds(ids: string[]): BailQuery[] {
  return bailQueries.filter((q) => ids.includes(q.id))
}

/**
 * Filtre les queries par format attendu
 */
export function getQueriesByFormat(format: string): BailQuery[] {
  return bailQueries.filter((q) => q.expectedType === format)
}

/**
 * Récupère uniquement les queries textes (sans métadonnées)
 */
export function getQueryStrings(): string[] {
  return bailQueries.map((q) => q.query)
}

/**
 * Récupère les queries avec leurs métadonnées simplifiées
 */
export function getQueriesWithMetadata() {
  return bailQueries.map((q) => ({
    id: q.id,
    query: q.query,
    expectedType: q.expectedType as string,
  }))
}
/**
 * Groupe les queries par catégorie basée sur les IDs
 */
export function groupQueriesByCategory() {
  const categories = new Map<string, BailQuery[]>()

  bailQueries.forEach((query) => {
    // Extraire la catégorie du préfixe de l'ID (ex: "bailleur_" -> "bailleur")
    const category = query.id.split("_")[0]

    if (!categories.has(category)) {
      categories.set(category, [])
    }

    categories.get(category)?.push(query)
  })

  return Object.fromEntries(categories)
}

/**
 * Récupère les IDs de toutes les queries
 */
export function getQueryIds(): string[] {
  return bailQueries.map((q) => q.id)
}
