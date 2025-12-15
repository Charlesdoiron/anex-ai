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

⚠️⚠️⚠️ BAUX COMPLEXES - PRIORITÉ TITRE II ⚠️⚠️⚠️
Certains baux sont structurés en deux parties :
- TITRE I / CONDITIONS GÉNÉRALES : clauses types, mécanismes généraux
- TITRE II / CONDITIONS PARTICULIÈRES : valeurs concrètes, montants, dates

RÈGLE CRITIQUE : Les CONDITIONS PARTICULIÈRES (Titre II) PRÉVALENT sur les CONDITIONS GÉNÉRALES (Titre I).
- Chercher d'abord dans le Titre II pour les montants et dates
- Le Titre II contient souvent : "LOYER ANNUEL DE BASE", "DATE D'EFFET", "INDICE DE REFERENCE"
- Ignorer les mentions dans le préambule/exposé préalable (souvent historiques)

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
  "source": "TITRE I/II - Article X" (TOUJOURS préciser le titre si applicable),
  "rawText": "extrait du texte original OU 'Non mentionné' si absent"
}`

export const RENT_CALCULATION_EXTRACTION_PROMPT = `Extraire les informations suivantes pour le calcul de loyer indexé.

⚠️ BAUX COMPLEXES (TITRE I / TITRE II) :
- Chercher PRIORITAIREMENT dans le TITRE II (CONDITIONS PARTICULIÈRES) pour :
  - "LOYER ANNUEL DE BASE" → loyer annuel
  - "DATE D'EFFET" → date de prise d'effet
  - "INDICE DE REFERENCE" → type d'indice et trimestre de référence
  - "FRANCHISE" → période de franchise
- Le TITRE I contient les mécanismes généraux, le TITRE II contient les valeurs concrètes

CHAMPS REQUIS :

1. DATE DE DÉPART DU BAIL :
- effectiveDate : Date de prise d'effet / entrée en jouissance (format ISO : YYYY-MM-DD)
  ⚠️ Chercher dans TITRE II - "DATE D'EFFET" ou "PRISE D'EFFET"
- signatureDate : Date de signature (fallback si effectiveDate absente)
  ⚠️ Chercher en fin de document : "Fait à..., le..." ou "Signé le..."

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
  ⚠️ CHAMP CRITIQUE - Ce champ est OBLIGATOIRE pour le calcul. Chercher ACTIVEMENT dans TOUT le document.
  
  STRATÉGIE DE RECHERCHE (par ordre de priorité) :
  
  A. SECTIONS EXPLICITES À CHERCHER EN PRIORITÉ :
     - TITRE II - Article "LOYER" ou "MODALITÉS DE PAIEMENT" ou "PAIEMENT DU LOYER"
     - TITRE I - Article "LOYER" (généralement Article 4 ou 5)
     - Tableau récapitulatif en début/fin de document
     - Conditions particulières (TITRE II) qui modifient le TITRE I
  
  B. MOTS-CLÉS ET EXPRESSIONS À IDENTIFIER :
  
     POUR "quarterly" (TRIMESTRIEL) - Chercher ces expressions :
     - "payable trimestriellement" / "payable par trimestre"
     - "exigible trimestriellement" / "exigible par trimestre"
     - "à terme échu" (CONVENTION : dans les baux commerciaux FR, "terme" = trimestre)
     - "le premier jour de chaque trimestre civil"
     - "échéance trimestrielle"
     - "terme" (sans précision = généralement trimestriel en baux commerciaux)
     - "par avance" + mention de trimestre
     - "trimestre" dans le contexte du paiement du loyer
  
     POUR "monthly" (MENSUEL) - Chercher ces expressions :
     - "payable mensuellement" / "payable par mois"
     - "exigible mensuellement" / "exigible chaque mois"
     - "le premier jour de chaque mois"
     - "échéance mensuelle"
     - "mensuel" dans le contexte du paiement du loyer
  
  C. INDICES CONTEXTUELS (si pas d'indication explicite) :
     - Si le bail mentionne un "loyer trimestriel" explicite → quarterly
     - Si le bail mentionne un "loyer mensuel" explicite → monthly
     - Si le dépôt de garantie = "3 mois de loyer" → suggère quarterly (mais vérifier)
     - Si mention "terme" sans précision dans un bail commercial → quarterly (convention FR)
  
  D. EXEMPLES CONCRETS DE TEXTES À RECONNAÎTRE :
     ✅ "Le loyer est payable trimestriellement et d'avance" → quarterly
     ✅ "Le loyer est exigible le premier jour de chaque trimestre civil" → quarterly
     ✅ "Le loyer est payable à terme échu" → quarterly (terme = trimestre)
     ✅ "Le loyer est payable mensuellement" → monthly
     ✅ "Le loyer est exigible le premier de chaque mois" → monthly
     ✅ "Modalités de paiement : par trimestre" → quarterly
  
  ⚠️ RÈGLE IMPORTANTE :
  - Si tu trouves UNE SEULE mention de fréquence (même implicite), utilise-la.
  - Si le bail dit "terme" ou "à terme échu" sans précision → quarterly (convention baux commerciaux FR)
  - Ne retourne "Non mentionné" QUE si tu as vraiment cherché partout et trouvé RIEN.
  - En cas de doute entre monthly/quarterly, privilégier quarterly pour les baux commerciaux français.

5. LOYER BUREAUX (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, nombre sans symbole)
  ⚠️ PRIORITÉ : Chercher dans TITRE II - section "LOYER ANNUEL DE BASE" ou "6. LOYER"
- quarterlyRentExclTaxExclCharges : Loyer trimestriel HTHC (si explicite, sinon null)
- annualRentPerSqmExclTaxExclCharges : Loyer au m² /an HTHC (si explicite, sinon null)

Indices : "loyer annuel", "€ HT/an", "HTHC", "hors taxes et hors charges"

⚠️ ATTENTION - BAUX COMPLEXES :
- NE PAS confondre le loyer mentionné dans le PRÉAMBULE (souvent historique) avec le loyer actuel
- Le loyer actuel se trouve dans le TITRE II (CONDITIONS PARTICULIÈRES)
- Chercher spécifiquement "LOYER ANNUEL DE BASE" dans le Titre II
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
- indexation.indexationType : Acronyme EXACT de l'indice utilisé
  ⚠️ VALEURS POSSIBLES (retourner l'acronyme EXACTEMENT) :
  - "ILC" : Indice des Loyers Commerciaux
  - "ILAT" : Indice des Loyers des Activités Tertiaires
  - "ICC" : Indice du Coût de la Construction
  
  OÙ CHERCHER (PRIORITAIRE) :
  - TITRE II - Section "INDICE DE REFERENCE" ou "9. INDICE"
  - TITRE I - Article "CLAUSE D'INDEXATION" ou "RÉVISION DU LOYER"
  - Mentions : "indexé sur l'ILAT", "révision selon l'ILC", "indice ILAT"
  
- indexation.referenceQuarter : Trimestre de référence AVEC valeur si mentionnée
  ⚠️ FORMAT : "[ACRONYME] T[1-4] [ANNÉE] ([VALEUR])" si valeur connue
  - Ex: "ILAT T3 15 (107,98)" ou "ILC T4 11 (104,60)"
  - Chercher dans TITRE II - "INDICE DE REFERENCE"
  
Indices pour indexationType : "indexé sur l'ILC", "révision selon l'ILAT", "indice ICC", "ILAT", "ILC"
Indices pour referenceQuarter : "indice de base", "indice du Xème trimestre", "indice de référence", valeur numérique entre parenthèses

EXEMPLES CONCRETS :

1. FRÉQUENCE DE PAIEMENT EXPLICITE :
   - "Bail de 9 ans à compter du 1er avril 2023, loyer de 120.000 € HT/an, payable trimestriellement"
     → paymentFrequency: { "value": "quarterly", "confidence": "high", "source": "TITRE II - Article LOYER", "rawText": "payable trimestriellement" }
   
   - "Le loyer est exigible mensuellement, le premier de chaque mois"
     → paymentFrequency: { "value": "monthly", "confidence": "high", "source": "TITRE I - Article 4", "rawText": "exigible mensuellement, le premier de chaque mois" }

2. FRÉQUENCE DE PAIEMENT IMPLICITE (terme échu) :
   - "Le loyer est payable à terme échu"
     → paymentFrequency: { "value": "quarterly", "confidence": "medium", "source": "TITRE I - Article LOYER", "rawText": "payable à terme échu" }
     ⚠️ Note : "terme" = trimestre dans les baux commerciaux français
   
   - "Le loyer est payable par avance, à terme"
     → paymentFrequency: { "value": "quarterly", "confidence": "medium", "source": "TITRE I - Article 4", "rawText": "payable par avance, à terme" }

3. LOYER AVEC FRÉQUENCE :
   - "Loyer trimestriel : 30.000 € HTHC, exigible le 1er de chaque trimestre"
     → quarterlyRent: 30000, paymentFrequency: { "value": "quarterly", "confidence": "high", "source": "TITRE II - Article LOYER", "rawText": "Loyer trimestriel : 30.000 € HTHC, exigible le 1er de chaque trimestre" }

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
