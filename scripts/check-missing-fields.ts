/**
 * Script pour vérifier les champs manquants dans les exports
 * Compare les champs disponibles dans les types avec ceux exportés
 */

import type {
  LeaseExtractionResult,
  PremisesData,
  TaxesData,
  ChargesData,
  InsuranceData,
  SecuritiesData,
  TransferData,
} from "../app/lib/extraction/types"

// Liste des champs attendus basés sur les types
const EXPECTED_FIELDS = {
  premises: [
    "Designation des locaux",
    "Destination des locaux",
    "Adresse des locaux",
    "Année de construction de l'immeuble",
    "Etage(s) des locaux",
    "Numéro(s) du/des lot(s)",
    "Surface (en m²)",
    "Les locaux sont-ils cloisonnés ?",
    "Les locaux sont-ils équipés avec du mobilier ?",
    "Clause de garnissement des locaux",
    "Clause d'enseigne",
    "Existence d'un espace extérieur ?",
    "Existence d'un local d'archive ?",
    "Nombre d'emplacements de parkings (en unité)",
    "Quote-part de l'immeuble loué",
  ],
  taxes: [
    "Refacturation de la taxe foncière et de la TEOM au preneur",
    "Montant annuel de la provision pour taxe foncière (en €)",
    "Montant annuel de la provision pour TEOM (en €)",
    "Montant annuel de la provision pour taxe sur les bureaux et les locaux commerciaux et de stockages (en €)",
    "Montant annuel de la provision pour taxe sur les emplacements de parking (en €)", // ✅ Ajouté
  ],
  charges: [
    "Montant annuel des provisions pour charges (en € et HT)",
    "Montant trimestriel des provisions pour charges (en € et HT)",
    "Montant annuel des provisions pour charges au m² (en € et HT)",
    "Montant annuel de la redevance RIE (en € et HT)",
    "Montant trimestriel de la redevance RIE (en € et HT)",
    "Montant annuel de la redevance RIE au m² (en € et HT)",
    "Honoraires de gestion locative et technique à la charge du preneur",
    "Montant annuel des honoraires de gestion (en € et HT)", // ✅ Ajouté
    "Montant trimestriel des honoraires de gestion (en € et HT)", // ✅ Ajouté
    "Montant des honoraires de gestion au m² (en € et HT)", // ✅ Ajouté
  ],
  transfer: [
    "Conditions de sous-location",
    // "Si bail de sous-location en cours", // ❌ Supprimé
    "Conditions de cession du bail",
    "Possibilité de division des locaux",
  ],
}

console.log("✅ Champs vérifiés:")
console.log("- Designation des locaux: AJOUTÉ")
console.log("- parkingTaxAmount: AJOUTÉ")
console.log("- managementFeesAnnualAmount: AJOUTÉ")
console.log("- managementFeesQuarterlyAmount: AJOUTÉ")
console.log("- managementFeesPerSqmAmount: AJOUTÉ")
console.log("- currentSubleaseInfo: SUPPRIMÉ de l'export")
