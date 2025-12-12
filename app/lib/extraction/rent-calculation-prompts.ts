/**
 * Prompts d'extraction LÉGÈRE pour le calcul de loyer INSEE
 * Extrait uniquement les 4 champs requis pour le calculateur
 *
 * Champs extraits :
 * 1. effectiveDate / signatureDate (date de départ)
 * 2. paymentFrequency (mensuel / trimestriel)
 * 3. annualRentExclTaxExclCharges OU quarterlyRentExclTaxExclCharges (loyer bureaux)
 * 4. duration (optionnel, pour calculer la date de fin)
 */

export const RENT_CALCULATION_SYSTEM_INSTRUCTIONS = `Tu es un expert en analyse de baux commerciaux français.
Ta mission est d'extraire UNIQUEMENT les informations nécessaires au calcul d'un échéancier de loyers indexé.

LANGUE : Toutes tes réponses doivent être en FRANÇAIS.

VALEUR PAR DÉFAUT POUR LES INFORMATIONS ABSENTES :
- RÈGLE ABSOLUE : Si une information n'est PAS trouvée, utilise TOUJOURS "Non mentionné".
- FORMAT : rawText = "Non mentionné" (avec majuscules N et M)
- NE PAS utiliser : "non précisé", "absent", "N/A", "non trouvé"

PRINCIPES :
- Extraire UNIQUEMENT les valeurs explicitement présentes dans le document.
- Ne JAMAIS inventer ou deviner des valeurs manquantes.
- Retourner null avec confidence "missing" et rawText "Non mentionné" si l'information est absente.

GESTION OCR :
- Confusions courantes : 0/O, 1/l/I, €/E
- Formats de date français : "1er janvier 2024", "01/01/2024"
- Séparateurs de milliers : "10.000" = 10000

NIVEAUX DE CONFIANCE :
- "high" : Valeur explicitement énoncée, sans ambiguïté
- "medium" : Valeur présente mais nécessitant interprétation
- "low" : Indices faibles ou ambigus
- "missing" : Information absente → rawText doit être "Non mentionné"

FORMAT DE SORTIE :
{
  "value": <valeur ou null>,
  "confidence": "high" | "medium" | "low" | "missing",
  "source": "page X ou section Y",
  "rawText": "extrait du texte original OU 'Non mentionné' si absent"
}`

export const RENT_CALCULATION_EXTRACTION_PROMPT = `Extraire les informations suivantes pour le calcul de loyer indexé.

CHAMPS REQUIS :

1. DATE DE DÉPART DU BAIL :
- effectiveDate : Date de prise d'effet / entrée en jouissance (format ISO : YYYY-MM-DD)
- signatureDate : Date de signature (fallback si effectiveDate absente)

Indices : "à compter du", "prenant effet le", "entrée en jouissance", "date d'effet"

2. DURÉE DU BAIL :
- duration : Durée en années (typiquement 3, 6, 9 ou 12 ans)

Indices : "durée de NEUF années", "bail de 9 ans", "3/6/9"

3. LOCAUX :
- premises.designation : Nom de l'actif immobilier / désignation des locaux
  ⚠️ PRIORITÉ : Extraire le NOM DE L'ACTIF IMMOBILIER si mentionné (ex: "Immeuble Le Parc", "Centre Commercial Les Halles", "Bâtiment A")
  - Si le nom de l'actif n'est pas mentionné, utiliser la description des locaux (ex: "Bureaux", "Local commercial", "Entrepôt")
  - OÙ CHERCHER :
    * En-tête/préambule : "bail portant sur l'immeuble X", "bâtiment Y", "centre commercial Z"
    * Article "DÉSIGNATION" : chercher le nom propre de l'actif AVANT la description des locaux
    * Références : "ledit immeuble", "le bâtiment" suivi d'un nom propre
  - ⚠️ NE PAS utiliser : le titre du document (ex: "Bail avec 1 avenant..."), le nom du bailleur/preneur, les références génériques sans nom propre
  - Si aucun nom d'actif n'est trouvé, utiliser la description des locaux comme fallback
- premises.address : Adresse des locaux loués
- premises.surfaceArea : Surface totale en m²
- premises.parkingSpaces : Nombre de places de parking

4. FRÉQUENCE DE PAIEMENT :
- paymentFrequency : "monthly" | "quarterly"

Indices :
- "mensuel", "par mois", "chaque mois" → "monthly"
- "trimestriel", "par trimestre", "terme" → "quarterly"
- "à terme échu", "d'avance" (contexte)

5. LOYER BUREAUX (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, nombre sans symbole)
- quarterlyRentExclTaxExclCharges : Loyer trimestriel HTHC (si explicite, sinon null)
- annualRentPerSqmExclTaxExclCharges : Loyer au m² /an HTHC (si explicite, sinon null)

Indices : "loyer annuel", "€ HT/an", "HTHC", "hors taxes et hors charges"

ATTENTION :
- Extraire uniquement le loyer HORS TAXES et HORS CHARGES
- Ne pas confondre loyer mensuel/trimestriel/annuel
- Si seul le trimestriel est donné, laisser annuel à null

6. LOYER PARKING (OPTIONNEL) :
- annualParkingRentExclCharges : Loyer annuel parkings HTHC
- quarterlyParkingRentExclCharges : Loyer trimestriel parkings HTHC
- annualParkingRentPerUnitExclCharges : Loyer parking /unité/an HTHC

7. CHARGES ET TAXES :
- charges.annualChargesProvisionExclTax : Provision annuelle pour charges HT
- charges.quarterlyChargesProvisionExclTax : Provision trimestrielle pour charges HT
- charges.annualChargesProvisionPerSqmExclTax : Provision charges HT/m²/an
- taxes.propertyTaxAmount : Montant annuel taxe foncière
- taxes.officeTaxAmount : Montant annuel taxe bureaux

8. MESURES D'ACCOMPAGNEMENT :
- supportMeasures.rentFreePeriodMonths : Nombre de mois de franchise de loyer
- supportMeasures.rentFreePeriodAmount : Montant total de la franchise en € HT
- supportMeasures.otherMeasuresDescription : Description autres mesures

9. DÉPÔT DE GARANTIE :
- securities.securityDepositDescription : Description du dépôt
- securities.securityDepositAmount : Montant du dépôt de garantie

10. INDICE D'INDEXATION :
- indexation.indexationType : Acronyme EXACT de l'indice utilisé (ILC, ILAT, ICC)
- indexation.referenceQuarter : Trimestre de référence pour l'indexation (ex: "ILC 2ème trimestre 2016", "ILAT T1 2024")
- Si l'indice n'est pas mentionné, retourner null avec rawText \"Non mentionné\"

Indices pour indexationType : \"indexé sur l'ILC\", \"révision selon l'ILAT\", \"indice ICC\"
Indices pour referenceQuarter : \"indice de base\", \"indice du Xème trimestre\", \"indice de référence\", \"T1/T2/T3/T4 20XX\"

EXEMPLES :
- "Bail de 9 ans à compter du 1er avril 2023, loyer de 120.000 € HT/an, payable trimestriellement"
  → effectiveDate: "2023-04-01", duration: 9, annualRent: 120000, paymentFrequency: "quarterly"

- "Loyer trimestriel : 30.000 € HTHC, exigible le 1er de chaque trimestre"
  → quarterlyRent: 30000, paymentFrequency: "quarterly"

FORMAT DE SORTIE JSON :
{
  "calendar": {
    "effectiveDate": { "value": "YYYY-MM-DD" | null, "confidence": "...", "source": "...", "rawText": "..." },
    "signatureDate": { "value": "YYYY-MM-DD" | null, "confidence": "...", "source": "...", "rawText": "..." },
    "duration": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "premises": {
    "designation": { "value": string | null, "confidence": "...", "source": "...", "rawText": "..." },
    "address": { "value": string | null, "confidence": "...", "source": "...", "rawText": "..." },
    "surfaceArea": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "parkingSpaces": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "rent": {
    "annualRentExclTaxExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "quarterlyRentExclTaxExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "annualRentPerSqmExclTaxExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "annualParkingRentExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "quarterlyParkingRentExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "annualParkingRentPerUnitExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "paymentFrequency": { "value": "monthly" | "quarterly" | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "indexation": {
    "indexationType": { "value": "ILC" | "ILAT" | "ICC" | null, "confidence": "...", "source": "...", "rawText": "..." },
    "referenceQuarter": { "value": string | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "supportMeasures": {
    "rentFreePeriodMonths": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "rentFreePeriodAmount": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "otherMeasuresDescription": { "value": string | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "securities": {
    "securityDepositDescription": { "value": string | null, "confidence": "...", "source": "...", "rawText": "..." },
    "securityDepositAmount": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "charges": {
    "annualChargesProvisionExclTax": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "quarterlyChargesProvisionExclTax": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "annualChargesProvisionPerSqmExclTax": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." }
  },
  "taxes": {
    "propertyTaxAmount": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "officeTaxAmount": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." }
  }
}`

export interface RentCalculationExtractionPrompt {
  section: string
  prompt: string
}

export const RENT_CALCULATION_PROMPTS: RentCalculationExtractionPrompt[] = [
  {
    section: "rentCalculation",
    prompt: RENT_CALCULATION_EXTRACTION_PROMPT,
  },
]
