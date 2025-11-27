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

PRINCIPES :
- Extraire UNIQUEMENT les valeurs explicitement présentes dans le document.
- Ne JAMAIS inventer ou deviner des valeurs manquantes.
- Retourner null avec confidence "missing" si l'information est absente.

GESTION OCR :
- Confusions courantes : 0/O, 1/l/I, €/E
- Formats de date français : "1er janvier 2024", "01/01/2024"
- Séparateurs de milliers : "10.000" = 10000

NIVEAUX DE CONFIANCE :
- "high" : Valeur explicitement énoncée, sans ambiguïté
- "medium" : Valeur présente mais nécessitant interprétation
- "low" : Indices faibles ou ambigus
- "missing" : Information absente

FORMAT DE SORTIE :
{
  "value": <valeur ou null>,
  "confidence": "high" | "medium" | "low" | "missing",
  "source": "page X ou section Y",
  "rawText": "extrait du texte original"
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

3. FRÉQUENCE DE PAIEMENT :
- paymentFrequency : "monthly" | "quarterly"

Indices :
- "mensuel", "par mois", "chaque mois" → "monthly"
- "trimestriel", "par trimestre", "terme" → "quarterly"
- "à terme échu", "d'avance" (contexte)

4. LOYER BUREAUX (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, nombre sans symbole)
- quarterlyRentExclTaxExclCharges : Loyer trimestriel HTHC (si explicite, sinon null)

Indices : "loyer annuel", "€ HT/an", "HTHC", "hors taxes et hors charges"

ATTENTION :
- Extraire uniquement le loyer HORS TAXES et HORS CHARGES
- Ne pas confondre loyer mensuel/trimestriel/annuel
- Si seul le trimestriel est donné, laisser annuel à null

5. LOYER PARKING (OPTIONNEL) :
- annualParkingRentExclCharges : Loyer annuel parkings HTHC

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
  "rent": {
    "annualRentExclTaxExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "quarterlyRentExclTaxExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "annualParkingRentExclCharges": { "value": number | null, "confidence": "...", "source": "...", "rawText": "..." },
    "paymentFrequency": { "value": "monthly" | "quarterly" | null, "confidence": "...", "source": "...", "rawText": "..." }
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
