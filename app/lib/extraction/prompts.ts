/**
 * Prompts d'extraction pour les baux commerciaux français
 * Utilisation de l'API Responses d'OpenAI avec sortie structurée
 *
 * ARCHITECTURE D'EXTRACTION :
 * 1. Ces prompts extraient UNIQUEMENT les valeurs explicitement présentes dans le document
 * 2. Les champs dérivés sont calculés par post-process.ts APRÈS l'extraction
 * 3. Le LLM ne doit PAS calculer lui-même les valeurs dérivées
 *
 * CHAMPS CALCULÉS AUTOMATIQUEMENT (voir post-process.ts) :
 * - calendar.endDate : effectiveDate + duration
 * - calendar.nextTriennialDate : prochaine échéance triennale
 * - rent.quarterlyRentExclTaxExclCharges : annualRent / 4
 * - rent.annualRentPerSqmExclTaxExclCharges : annualRent / surfaceArea
 * - rent.annualParkingRentPerUnitExclCharges : parkingRent / parkingSpaces
 * - charges.quarterlyChargesProvisionExclTax : annualCharges / 4
 * - charges.annualChargesProvisionPerSqmExclTax : annualCharges / surfaceArea
 * - charges.annualRIEFeePerSqmExclTax : annualRIEFee / surfaceArea
 * - supportMeasures.rentFreePeriodAmount : mois × loyer mensuel
 */

export const SYSTEM_INSTRUCTIONS = `Tu es un expert juridique spécialisé dans l'analyse de baux commerciaux français.
Ta mission est d'extraire des informations précises à partir de documents de bail.

LANGUE DE RÉPONSE :
- Toutes tes réponses (rawText, source, descriptions) doivent être en FRANÇAIS.
- N'utilise JAMAIS d'anglais dans tes réponses (pas de "not found", "missing", etc.).
- Si une information est absente, utilise : "non mentionné", "non précisé", "absent du document".

PRINCIPES FONDAMENTAUX :
- Extraire UNIQUEMENT les informations explicitement présentes dans le document.
- Ne JAMAIS inventer, déduire de connaissances externes, ou deviner des valeurs manquantes.
- Il est TOUJOURS préférable de retourner null (avec confidence "missing") qu'une valeur imprécise ou spéculative.

GESTION DE LA QUALITÉ OCR :
Le texte provient souvent d'une reconnaissance optique de caractères (OCR) et peut contenir des erreurs :
- Confusions courantes : 0/O, 1/l/I, 5/S, 8/B, €/E, é/e, etc.
- Espacements incorrects : "10 000" vs "10000", "m 2" vs "m²"
- Mots coupés ou fusionnés : "bail commercial" vs "bailcommercial"
- Caractères spéciaux altérés : "€" → "EUR", "²" → "2", "°" → "o"
- Tableaux mal reconnus : colonnes mélangées, alignements cassés

ERREURS OCR SPÉCIFIQUES AUX SURFACES :
- "m?" = "m²" (le point d'interrogation remplace souvent le ²)
- "m'" = "m²" (l'apostrophe remplace souvent le ²)
- "m 2" ou "m2" = "m²"
- Les points dans les nombres français sont des séparateurs de milliers :
  - "3.613 m²" = 3613 m² (trois mille six cent treize)
  - "1.400 m²" = 1400 m² (mille quatre cents)

ERREURS OCR SPÉCIFIQUES AUX EMAILS :
- "@" peut devenir "a", "©", "(a)", "[at]"
- Les points peuvent disparaître : "exemplecom" au lieu de "exemple.com"

Quand tu rencontres ces problèmes :
- Interprète avec bon sens les erreurs évidentes (ex: "l0 000 €" = 10 000 €)
- Si l'ambiguïté est trop forte, utilise confidence "low" ou "missing"
- Mentionne les problèmes OCR dans le champ rawText si pertinent

NIVEAUX DE CONFIANCE :
- "high" : Valeur explicitement et clairement énoncée dans le texte, sans ambiguïté. Tu peux citer l'extrait exact.
- "medium" : Valeur présente mais nécessitant une interprétation (synthèse de clauses dispersées, formulation indirecte).
- "low" : Indices faibles ou ambigus. Rare ; préférer "missing" en cas de doute.
- "missing" : Information absente ou trop ambiguë. Retourner value = null et confidence = "missing".

CHAMPS CALCULABLES (ne pas extraire si absent) :
Certains champs seront calculés automatiquement après l'extraction :
- Loyer trimestriel, loyer au m², date de fin, échéance triennale, etc.
- Si tu ne trouves PAS explicitement ces valeurs dans le document, laisse-les null.
- NE PAS calculer toi-même ces valeurs, le système s'en charge.

FORMAT DE SORTIE :
Pour chaque champ extrait :
{
  "value": <valeur extraite ou null>,
  "confidence": "high" | "medium" | "low" | "missing",
  "source": "page X" ou "section Y" (localisation dans le document),
  "rawText": "extrait du texte original supportant la valeur" (optionnel mais recommandé)
}

Tu recevras le texte complet du document et devras extraire des sections spécifiques.`

export const REGIME_PROMPT = `Extraire le régime juridique du bail.

VALEURS POSSIBLES :
- "commercial" : Bail commercial classique (L.145-1 et suivants du Code de commerce)
- "civil" : Bail de droit commun (Code civil)
- "précaire" : Convention d'occupation précaire
- "dérogatoire" : Bail dérogatoire (≤ 3 ans, article L.145-5)
- "à construire" : Bail à construire
- "à construction" : Bail à construction (emphytéotique)
- "BEFA" : Bail en l'État Futur d'Achèvement
- "unknown" : Type non identifiable

INDICES À RECHERCHER :
- Titre du document : "BAIL COMMERCIAL", "CONTRAT DE BAIL", etc.
- Références légales : "L.145-1", "Code de commerce", "Code civil"
- Durée : Un bail de 3/6/9 ans suggère un bail commercial
- Mentions explicites : "bail dérogatoire", "convention précaire"
- "Type 3/6/9" = bail commercial

EXEMPLES :
- "Le présent BAIL COMMERCIAL est consenti..." → regime: "commercial"
- "BAIL COMMERCIAL de Type 3/6/9" → regime: "commercial"
- "Convention d'occupation précaire..." → regime: "précaire"
- "Bail dérogatoire de 23 mois en application de l'article L.145-5..." → regime: "dérogatoire"

IMPORTANT - Format de sortie EXACT :
{
  "regime": {
    "value": "commercial",
    "confidence": "high",
    "source": "page X ou section Y",
    "rawText": "extrait du texte"
  }
}`

export const PARTIES_PROMPT = `Extraire les informations sur toutes les parties au contrat.

PARTIES À IDENTIFIER :
1. Bailleur (propriétaire) : personne physique ou morale qui loue le bien
2. Représentant du bailleur : mandataire, gérant, administrateur de biens (si applicable)
3. Preneur (locataire) : personne physique ou morale qui prend le bien en location

INFORMATIONS À EXTRAIRE POUR CHAQUE PARTIE :
- name : Nom complet (personne physique) ou dénomination sociale (société)
- email : Adresse email
- phone : Numéro de téléphone
- address : Adresse postale complète (siège social pour les sociétés)
- siren : Numéro SIREN (9 chiffres) de l'entreprise si personne morale

GESTION DES NOMS ILLISIBLES OU MASQUÉS :
L'OCR peut produire du texte illisible pour les noms des parties :
- Caractères remplacés par des symboles : "@@@", "###", "***", "EEEE", "XXXX"
- Texte corrompu : "La i son si¢ge socia!", "Ee: 2. capital dc"
- Espaces ou caractères manquants
Dans ces cas :
- Si le texte est partiellement lisible, extraire ce qui est lisible
- Si le texte est totalement corrompu, retourner null avec confidence "missing"
- Mentionner dans rawText : "nom masqué ou illisible dans le document"

OÙ CHERCHER LES EMAILS ET TÉLÉPHONES :
Les coordonnées peuvent se trouver dans plusieurs endroits du document :
- En-tête ou pied de page du document
- Section "Notifications" ou "Correspondances" (adresses pour les envois)
- Après le nom des parties dans le préambule
- Dans les annexes ou conditions particulières
- Format email : xxx@xxx.xx (attention OCR : @ peut devenir "a", "©")
- Format téléphone : 01 XX XX XX XX, +33 X XX XX XX XX, 06.XX.XX.XX.XX

INDICES COURANTS :
- "ENTRE LES SOUSSIGNÉS :", "D'UNE PART :", "D'AUTRE PART :"
- "ci-après dénommé le Bailleur / le Preneur"
- "représenté par M./Mme X en qualité de..."
- Forme juridique : SCI, SARL, SAS, SA, EURL, etc.
- RCS, SIRET, SIREN, capital social
- Le SIREN est un numéro à 9 chiffres (les 9 premiers chiffres du SIRET)
- Format SIREN : "123 456 789" ou "123456789" (avec ou sans espaces)
- "domicile élu", "adresse de notification", "toute correspondance"

EXEMPLES :
- "La SCI IMMOBILIER PARISIEN, [...] représentée par M. Jean DUPONT, son gérant"
  → landlord.name: "SCI IMMOBILIER PARISIEN", landlordRepresentative.name: "Jean DUPONT"
- "La société TECH STARTUP SAS, au capital de 10.000 €, RCS Paris 123 456 789"
  → tenant.name: "TECH STARTUP SAS"
- "La société @@@@@, au capital de..." (nom masqué)
  → name: null, confidence: "missing", rawText: "nom masqué dans le document"
- "Toute notification sera adressée à contact@exemple.fr"
  → email: "contact@exemple.fr"

Format de sortie :
{
  "landlord": {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "email": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "address": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "siren": { "value": "..." ou null, "confidence": "...", "source": "..." }
  },
  "landlordRepresentative": { ... } ou null,
  "tenant": {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "email": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "address": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "siren": { "value": "..." ou null, "confidence": "...", "source": "..." }
  }
}`

export const PREMISES_PROMPT = `Extraire la description détaillée des locaux loués.

CHAMPS À EXTRAIRE :

1. DESTINATION ET IDENTIFICATION :
- purpose (destination) : Usage autorisé des locaux (bureaux, commerce, activité, etc.)
- designation : Description générale des locaux
- address : Adresse complète des locaux

2. CARACTÉRISTIQUES DU BÂTIMENT :
- buildingYear : Année de construction (important pour diagnostics amiante si avant 1997)
- floors : Étages concernés (liste : ["RDC", "1er", "2ème", etc.])
- lotNumbers : Numéros de lot (copropriété)

3. SURFACES :
- surfaceArea : Surface TOTALE en m² des locaux loués
  
  RÈGLES IMPORTANTES POUR LA SURFACE :
  - Extraire la surface TOTALE mentionnée, pas les surfaces partielles
  - Si plusieurs unités/lots sont loués, prendre la somme ou la surface globale
  - Privilégier : "surface totale", "surface exploitée", "superficie totale"
  - Ne pas confondre avec les surfaces détaillées par zone (vente, réserve, mezzanine)
  
  CORRECTION DES ERREURS OCR POUR LES SURFACES :
  - "m?" → "m²" (le ? est une erreur OCR du ²)
  - "m'" → "m²" (l'apostrophe est une erreur OCR du ²)
  - "m 2" → "m²"
  - "m2" → "m²"
  - "mètres carrés", "metres carres" → m²
  - Les points dans les nombres (3.613) sont des séparateurs de milliers = 3613
  
  EXEMPLES DE SURFACES :
  - "surface totale de 3.613 m?" → surfaceArea: 3613
  - "Surface Exploitée de 1 610 m?" → surfaceArea: 1610
  - "d'une superficie de 250 m'" → surfaceArea: 250

4. AMÉNAGEMENTS :
- isPartitioned : Locaux cloisonnés ou en open space
- hasFurniture : Présence de mobilier
- furnishingConditions : Description des conditions de mobilier
- signageConditions : Conditions d'enseigne/signalétique

5. ESPACES ANNEXES :
- hasOutdoorSpace : Espace extérieur (terrasse, cour)
- hasArchiveSpace : Local d'archives
- parkingSpaces : Nombre de places de parking voitures (nombre entier, 0 si absent)
- twoWheelerSpaces : Places deux-roues motorisés
- bikeSpaces : Places vélos

6. TANTIÈMES / QUOTE-PART :
- shareWithCommonAreas : Quote-part parties communes (en millièmes ou pourcentage)
- shareWithoutCommonAreas : Quote-part hors parties communes
- totalBuildingShare : Tantièmes sur l'ensemble de l'immeuble

EXEMPLES :
- "Locaux à usage de BUREAUX situés au 3ème étage, d'une surface de 250 m²"
  → purpose: "bureaux", floors: ["3ème"], surfaceArea: 250
- "15 emplacements de stationnement en sous-sol (-1)"
  → parkingSpaces: 15
- "L'Ensemble Immobilier d'une surface totale de 3.613 m? comprend trois unités"
  → surfaceArea: 3613 (surface TOTALE, pas les unités individuelles)
- "Locaux n° 3, d'une Surface Exploitée de 1 610 m?"
  → surfaceArea: 1610

ATTENTION - CAS COMPLEXES :
- Si le bail porte sur UN SEUL lot parmi plusieurs, extraire la surface de CE lot
- Si le bail porte sur TOUS les lots, extraire la surface TOTALE
- En cas de doute, mentionner dans rawText les différentes surfaces trouvées

Format de sortie JSON avec tous les champs ayant value, confidence, source.`

export const CALENDAR_PROMPT = `Extraire toutes les dates et durées liées au bail.

CHAMPS À EXTRAIRE :

1. DATES CLÉS :
- signatureDate : Date de signature du bail (format ISO : YYYY-MM-DD)
- effectiveDate : Date de prise d'effet / entrée en jouissance
- earlyAccessDate : Date de mise à disposition anticipée (si différente)
- endDate : Date de fin du bail (peut être calculée : effectiveDate + duration)

2. DURÉE :
- duration : Durée du bail en années (typiquement 3, 6, 9 ou 12 ans)

3. ÉCHÉANCES :
- nextTriennialDate : Prochaine échéance triennale (SEULEMENT si explicitement mentionnée)
  - Pour un bail 3/6/9, c'est la prochaine date où le locataire peut donner congé
  - Ne PAS calculer toi-même, extraire uniquement si présent dans le texte

4. PRÉAVIS ET RÉSILIATION :
- noticePeriod : Délai de préavis (ex: "6 mois avant l'échéance triennale")
- terminationConditions : Conditions de résiliation (congé, clause résolutoire)
- renewalConditions : Conditions de renouvellement

IMPORTANT - NE PAS CALCULER :
- Si endDate n'est pas explicitement mentionnée, laisser null (sera calculée automatiquement)
- Si nextTriennialDate n'est pas explicitement mentionnée, laisser null (sera calculée automatiquement)

ATTENTION AUX FORMATS DE DATE :
- Formats français : "1er janvier 2024", "01/01/2024", "1 janvier 2024"
- OCR peut altérer : "1er" → "1 er", "janvier" → "janvler"

EXEMPLES :
- "Le présent bail est consenti pour une durée de NEUF ANNEES ENTIERES ET CONSECUTIVES à compter du 1er avril 2023"
  → duration: 9, effectiveDate: "2023-04-01", endDate: "2032-04-01"
- "Le preneur pourra donner congé à chaque échéance triennale moyennant un préavis de six mois"
  → noticePeriod: "6 mois avant échéance triennale"

Format de sortie JSON avec dates en format ISO (YYYY-MM-DD).`

export const SUPPORT_MEASURES_PROMPT = `Extraire les mesures d'accompagnement accordées au preneur.

CHAMPS À EXTRAIRE :

1. FRANCHISE DE LOYER :
- hasRentFreeperiod : Présence d'une franchise de loyer (true/false)
- rentFreePeriodMonths : Nombre de mois de franchise
- rentFreePeriodAmount : Montant total de la franchise en euros HT (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

2. AUTRES MESURES :
- hasOtherMeasures : Présence d'autres mesures d'accompagnement
- otherMeasuresDescription : Description des autres mesures
  - Contribution aux travaux d'aménagement
  - Prise en charge de frais de déménagement
  - Réduction temporaire de loyer (paliers progressifs)

INDICES À RECHERCHER :
- "franchise de loyer", "exemption de loyer", "gratuité de loyer"
- "mesures d'accompagnement", "avantages consentis"
- "paliers de loyer", "loyer progressif"
- "participation aux travaux", "contribution du bailleur"

EXEMPLES :
- "Le bailleur accorde au preneur une franchise de loyer de 3 mois, soit 15.000 € HT"
  → hasRentFreeperiod: true, rentFreePeriodMonths: 3, rentFreePeriodAmount: 15000
- "Le loyer sera de 1.000 €/mois la 1ère année, 1.500 € la 2ème année, puis 2.000 €"
  → hasOtherMeasures: true, otherMeasuresDescription: "Loyer progressif sur 3 ans"

Format de sortie JSON conforme à SupportMeasuresData.`

export const RENT_PROMPT = `Extraire toutes les informations relatives au loyer.

CHAMPS À EXTRAIRE :

1. LOYER PRINCIPAL (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, sans symbole)
- quarterlyRentExclTaxExclCharges : Loyer trimestriel HTHC (SEULEMENT si explicite)
- annualRentPerSqmExclTaxExclCharges : Loyer annuel au m² HTHC (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

2. LOYER PARKING :
- annualParkingRentExclCharges : Loyer annuel parkings HTHC
- quarterlyParkingRentExclCharges : Loyer trimestriel parkings (SEULEMENT si explicite)
- annualParkingRentPerUnitExclCharges : Loyer par place (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

3. TVA ET MODALITÉS :
- isSubjectToVAT : Assujettissement à la TVA (true/false)
  - Rechercher : "option pour la TVA", "assujetti à la TVA", "TVA applicable"
- paymentFrequency : Fréquence de paiement ("monthly" | "quarterly" | "annual")
  - Termes : "mensuel", "trimestriel", "à terme échu", "d'avance"

4. PÉNALITÉS DE RETARD :
- latePaymentPenaltyConditions : Conditions des pénalités
- latePaymentPenaltyAmount : Montant ou taux des pénalités

INDICES COURANTS :
- "Le loyer annuel est fixé à...", "soit un loyer de X € HT/an"
- "payable par trimestre", "terme à échoir", "terme échu"
- "€ HT", "hors taxes", "HTHC", "hors taxes et hors charges"
- "intérêts de retard au taux légal majoré de X points"

ATTENTION AUX CONFUSIONS :
- Loyer HT vs TTC (toujours extraire HT)
- Loyer charges comprises vs hors charges (toujours extraire HC)
- Loyer mensuel vs trimestriel vs annuel

EXEMPLES :
- "Loyer annuel : 120.000 € HT HC, payable trimestriellement d'avance, soit 30.000 € par trimestre"
  → annualRent: 120000, quarterlyRent: 30000, paymentFrequency: "quarterly"
- "500 €/m²/an pour 200 m², soit 100.000 € annuels"
  → annualRent: 100000, rentPerSqm: 500

Format : valeurs numériques SANS symbole € ni séparateurs de milliers.`

export const INDEXATION_PROMPT = `Extraire les clauses d'indexation du loyer.

CHAMPS À EXTRAIRE :

1. CLAUSE ET TYPE :
- indexationClause : Texte de la clause d'indexation
- indexationType : Type d'indice utilisé
  - "ILC" : Indice des Loyers Commerciaux (le plus courant)
  - "ILAT" : Indice des Loyers des Activités Tertiaires
  - "ICC" : Indice du Coût de la Construction (ancien, moins utilisé)
  - Autre indice spécifique

2. RÉFÉRENCES ET FRÉQUENCE :
- referenceQuarter : Trimestre de référence (ex: "T2 2023", "2ème trimestre 2023")
  - Si non explicite, retourner null avec confidence "missing"
  - NE PAS écrire "not explicitly given" ou autre texte anglais
- firstIndexationDate : Date de première indexation (format ISO)
- indexationFrequency : Fréquence ("annual" | "quarterly" | "other")

INDICES À RECHERCHER :
- "révision du loyer", "indexation", "clause d'échelle mobile"
- "ILC publié par l'INSEE", "ILAT", "ICC"
- "indice de référence", "indice de base"
- "révision annuelle", "chaque année à la date anniversaire"

FORMULE TYPE :
Nouveau loyer = Loyer actuel × (Indice nouveau / Indice de base)

EXEMPLES :
- "Le loyer sera révisé annuellement selon l'ILC, première révision au 1er janvier 2025, indice de référence T2 2024"
  → indexationType: "ILC", firstIndexationDate: "2025-01-01", referenceQuarter: "T2 2024", indexationFrequency: "annual"
- "Indexation sur l'ILAT, trimestre de référence : 4ème trimestre 2023"
  → indexationType: "ILAT", referenceQuarter: "T4 2023"

Format de sortie JSON conforme à IndexationData.`

export const TAXES_PROMPT = `Extraire les informations sur les impôts et taxes.

CHAMPS À EXTRAIRE :

1. TAXE FONCIÈRE :
- propertyTaxRebilled : Refacturation au preneur (true/false)
  - Termes : "taxe foncière à la charge du preneur", "refacturation"
- propertyTaxAmount : Montant TOTAL annuel (si mentionné)

2. TAXE SUR LES BUREAUX (Île-de-France) :
- officeTaxAmount : Montant TOTAL de la taxe bureaux
  - Applicable en région parisienne selon les zones

ATTENTION - MONTANTS PAR M² vs MONTANTS TOTAUX :
- Si le document donne "40 €/m²" ou "17 euros HT par m2", ceci est un montant PAR M²
- propertyTaxAmount et officeTaxAmount doivent contenir les montants TOTAUX
- Si seul le montant par m² est donné, retourner null avec confidence "medium" et mentionner le montant par m² dans rawText

INDICES À RECHERCHER :
- "taxe foncière", "contribution foncière"
- "TEOM" (taxe d'enlèvement des ordures ménagères)
- "taxe sur les bureaux", "taxe annuelle sur les locaux à usage de bureaux"
- "à la charge du preneur", "supportée par le locataire"
- "€/m²", "euros hors taxes par m2" = montant par mètre carré

EXEMPLES :
- "La taxe foncière sera refacturée au preneur au prorata de la surface occupée"
  → propertyTaxRebilled: true
- "Taxe bureaux IDF estimée à 5.000 €/an"
  → officeTaxAmount: 5000
- "la taxe foncière se monte à environ 40 euros hors taxes par m2"
  → propertyTaxAmount: null, rawText: "40 €/m² (montant par m², total non calculé)"
- "la taxe sur les bureaux se monte a environ 17.08 euros hors taxes par m2"
  → officeTaxAmount: null, rawText: "17.08 €/m² (montant par m², total non calculé)"

Format de sortie JSON conforme à TaxesData.`

export const CHARGES_PROMPT = `Extraire les charges et honoraires de gestion.

CHAMPS À EXTRAIRE :

1. PROVISIONS POUR CHARGES :
- annualChargesProvisionExclTax : Provision TOTALE annuelle HT (en euros)
- quarterlyChargesProvisionExclTax : Provision trimestrielle HT (SEULEMENT si explicite)
- annualChargesProvisionPerSqmExclTax : Provision au m² HT (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

2. REDEVANCE RIE (Règlement Intérieur d'Exploitation) :
- annualRIEFeeExclTax : Redevance TOTALE annuelle HT
- quarterlyRIEFeeExclTax : Redevance trimestrielle HT (SEULEMENT si explicite)
- annualRIEFeePerSqmExclTax : Redevance au m² HT (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

3. HONORAIRES DE GESTION :
- managementFeesOnTenant : Honoraires de gestion locative à charge du preneur
- rentManagementFeesOnTenant : Honoraires de gestion des loyers à charge du preneur

ATTENTION - MONTANTS PAR M² vs MONTANTS TOTAUX :
- Si le document donne "30 €/m²/an", ceci est un montant PAR M², pas le total
- annualChargesProvisionExclTax doit contenir le montant TOTAL annuel
- Si seul le montant par m² est donné :
  - Mettre le montant par m² dans annualChargesProvisionPerSqmExclTax
  - Laisser annualChargesProvisionExclTax à null (sera calculé automatiquement avec la surface)

INDICES À RECHERCHER :
- "provisions pour charges", "charges locatives", "charges récupérables"
- "régularisation annuelle", "au réel"
- "€/m²/an", "euros HT/m2/an" = montant par mètre carré
- "RIE", "règlement intérieur", "services généraux"
- "honoraires de gestion", "frais de gérance"

EXEMPLES :
- "Provision pour charges : 50 €/m²/an HT"
  → annualChargesProvisionPerSqmExclTax: 50, annualChargesProvisionExclTax: null
- "Provision pour charges : 10.000 € HT/an pour 200 m²"
  → annualChargesProvisionExclTax: 10000, annualChargesProvisionPerSqmExclTax: 50
- "La provision s'élève à 30 euros HT/m2/an"
  → annualChargesProvisionPerSqmExclTax: 30, annualChargesProvisionExclTax: null
- "Redevance RIE : 2.000 € HT/trimestre"
  → quarterlyRIEFeeExclTax: 2000

Format de sortie JSON avec valeurs numériques.`

export const INSURANCE_PROMPT = `Extraire les informations d'assurance et recours.

CHAMPS À EXTRAIRE :

1. ASSURANCE MULTIRISQUE :
- annualInsuranceAmountExclTax : Prime annuelle HT (si mentionnée)
- insurancePremiumRebilled : Prime refacturée au preneur (true/false)

2. CLAUSES SPÉCIFIQUES :
- hasWaiverOfRecourse : Renonciation à recours entre parties (true/false)
  - Clause très courante dans les baux commerciaux
  - Termes : "renonciation réciproque à recours", "abandon de recours"
- insuranceCertificateAnnexed : Attestation d'assurance en annexe (true/false)

INDICES À RECHERCHER :
- "assurance multirisque", "police d'assurance"
- "renonciation à recours", "abandon de recours réciproque"
- "attestation d'assurance", "justificatif annuel"
- "risques locatifs", "responsabilité civile"

EXEMPLES :
- "Le preneur devra justifier annuellement d'une assurance multirisque et fournir l'attestation au bailleur"
  → insuranceCertificateAnnexed: true (à fournir)
- "Les parties renoncent réciproquement à tout recours l'une contre l'autre et contre leurs assureurs respectifs"
  → hasWaiverOfRecourse: true

Format de sortie JSON conforme à InsuranceData.`

export const SECURITIES_PROMPT = `Extraire les sûretés et garanties.

CHAMPS À EXTRAIRE :

1. DÉPÔT DE GARANTIE :
- securityDepositAmount : Montant du dépôt de garantie (en euros)
  - Souvent exprimé en mois de loyer (ex: "3 mois de loyer HT HC")
  - Extraire le montant numérique si possible

2. AUTRES SÛRETÉS :
- otherSecurities : Liste des autres garanties (tableau de chaînes)
  - Garantie bancaire à première demande
  - Caution personnelle du dirigeant
  - Garantie maison-mère (société du groupe)
  - Nantissement de fonds de commerce
  - Garantie autonome

INDICES À RECHERCHER :
- "dépôt de garantie", "garantie", "caution"
- "garantie à première demande", "GAPD"
- "caution solidaire", "caution personnelle"
- "nantissement", "gage"
- Montant équivalent : "équivalent à X mois/trimestres de loyer"

EXEMPLES :
- "Dépôt de garantie : 30.000 € correspondant à 3 mois de loyer HT HC"
  → securityDepositAmount: 30000
- "Garantie bancaire à première demande de 50.000 € + caution solidaire du gérant"
  → otherSecurities: ["Garantie bancaire à première demande de 50.000 €", "Caution solidaire du gérant"]

Format de sortie JSON avec securityDepositAmount en nombre et otherSecurities en tableau.`

export const INVENTORY_PROMPT = `Extraire les informations sur les états des lieux.

CHAMPS À EXTRAIRE :

1. ÉTAT DES LIEUX D'ENTRÉE :
- entryInventoryConditions : Conditions et modalités
  - Contradictoire ou par huissier
  - À la charge de qui (frais)
  - Annexé au bail ou à établir

2. ÉTAT DES LIEUX DE PRÉ-SORTIE :
- hasPreExitInventory : Existence d'un pré-état des lieux (true/false)
- preExitInventoryConditions : Conditions (délai avant sortie, etc.)

3. ÉTAT DES LIEUX DE SORTIE :
- exitInventoryConditions : Conditions de l'état des lieux de sortie
  - Comparaison avec l'entrée
  - Frais de remise en état

INDICES À RECHERCHER :
- "état des lieux", "constat", "procès-verbal"
- "contradictoire", "amiable", "par huissier"
- "à l'entrée", "à la sortie", "lors de la restitution"
- "frais partagés", "à la charge du preneur/bailleur"

EXEMPLES :
- "Un état des lieux contradictoire sera établi lors de l'entrée et de la sortie, les frais étant partagés"
  → entryInventoryConditions: "État des lieux contradictoire, frais partagés"
- "Trois mois avant la fin du bail, un pré-état des lieux sera réalisé"
  → hasPreExitInventory: true, preExitInventoryConditions: "3 mois avant fin du bail"

Format de sortie JSON conforme à InventoryData.`

export const MAINTENANCE_PROMPT = `Extraire les conditions d'entretien et travaux.

CHAMPS À EXTRAIRE :

1. ENTRETIEN COURANT :
- tenantMaintenanceConditions : Obligations d'entretien du preneur
  - Entretien courant, menues réparations
  - Maintenance des équipements

2. RÉPARTITION DES TRAVAUX :
- landlordWorksList : Travaux à la charge du bailleur (tableau)
  - Gros œuvre, toiture, structure (article 606 Code civil)
  - Mise aux normes imposée par la loi
- tenantWorksList : Travaux à la charge du preneur (tableau)
  - Aménagements intérieurs
  - Réparations locatives

3. CONDITIONS SPÉCIFIQUES :
- workConditionsImposedOnTenant : Contraintes pour travaux du preneur
  - Autorisation préalable du bailleur
  - Entreprises agréées
  - Assurances spécifiques
- hasAccessionClause : Clause d'accession / sort des travaux (true/false)
  - Travaux acquis au bailleur en fin de bail

ARTICLE 606 DU CODE CIVIL (travaux bailleur typiques) :
- Gros murs, voûtes, planchers
- Poutres, toiture entière
- Digues, murs de soutènement

EXEMPLES :
- "Le preneur prend les locaux en l'état et aura à sa charge l'ensemble des travaux d'aménagement"
  → tenantWorksList: ["Travaux d'aménagement"]
- "Les travaux relevant de l'article 606 restent à la charge du bailleur"
  → landlordWorksList: ["Travaux article 606 du Code civil"]

Format de sortie JSON conforme à MaintenanceData.`

export const RESTITUTION_PROMPT = `Extraire les conditions de restitution des locaux.

CHAMPS À EXTRAIRE :

1. RESTITUTION :
- restitutionConditions : Conditions générales de restitution
  - État de restitution attendu
  - Délais, formalités
  - Sort des aménagements

2. REMISE EN ÉTAT :
- restorationConditions : Conditions de remise en état
  - Remise en état d'origine
  - Dépose des aménagements
  - Nettoyage, réparations

INDICES À RECHERCHER :
- "restitution des locaux", "remise des clés"
- "remise en état", "état d'origine", "pristin état"
- "démontage des aménagements", "dépose des cloisons"
- "libre de tout occupant et de tout mobilier"

EXEMPLES :
- "Le preneur restituera les locaux en bon état d'entretien, libres de toute occupation"
  → restitutionConditions: "Restitution en bon état d'entretien, locaux libres"
- "Sauf accord contraire, le preneur devra remettre les locaux dans leur état d'origine"
  → restorationConditions: "Remise en état d'origine obligatoire sauf accord"

Format de sortie JSON conforme à RestitutionData.`

export const TRANSFER_PROMPT = `Extraire les conditions de cession et sous-location.

CHAMPS À EXTRAIRE :

1. SOUS-LOCATION :
- sublettingConditions : Conditions de sous-location
  - Interdiction totale
  - Autorisation sous conditions
  - Accord préalable du bailleur

2. SOUS-LOCATION EN COURS :
- currentSubleaseInfo : Informations sur sous-location existante (si applicable)
  - subtenantName : Nom du sous-locataire
  - effectiveDate : Date d'effet
  - nextTerminationDate : Prochaine échéance
  - endDate : Date de fin

3. CESSION :
- assignmentConditions : Conditions de cession du bail
  - Cession libre à un successeur dans le fonds
  - Agrément du bailleur requis
  - Clause de garantie solidaire

4. DIVISION :
- divisionPossible : Possibilité de diviser les locaux (true/false)

INDICES À RECHERCHER :
- "sous-location", "sous-louer", "sous-locataire"
- "cession", "céder le bail", "transmission"
- "agrément", "accord préalable", "autorisation écrite"
- "garantie solidaire", "clause de substitution"
- "division des locaux", "fractionnement"

EXEMPLES :
- "La sous-location est strictement interdite"
  → sublettingConditions: "Sous-location interdite"
- "Le preneur pourra céder son bail à l'acquéreur de son fonds de commerce"
  → assignmentConditions: "Cession autorisée à l'acquéreur du fonds de commerce"

Format de sortie JSON conforme à TransferData.`

export const ENVIRONMENTAL_ANNEXES_PROMPT = `Extraire les annexes environnementales obligatoires.

CHAMPS À EXTRAIRE :

1. DPE (Diagnostic de Performance Énergétique) :
- hasDPE : Présence du DPE (true/false)
  - Obligatoire pour toute location
- dpeNote : Classe énergétique (A à G)
  - Attention OCR : A/4, B/8, G/6 peuvent être confondus

2. DIAGNOSTIC AMIANTE :
- hasAsbestosDiagnostic : Présence du diagnostic amiante (true/false)
  - Obligatoire pour immeubles construits avant juillet 1997

3. ANNEXE ENVIRONNEMENTALE :
- hasEnvironmentalAnnex : Présence de l'annexe environnementale (true/false)
  - Obligatoire pour surfaces > 2000 m² (décret "baux verts")
  - Échange d'informations sur consommations énergétiques

4. ÉTAT DES RISQUES ET POLLUTIONS :
- hasRiskAndPollutionStatement : Présence de l'ERP (true/false)
  - Ex-ERNMT, obligatoire selon zonage

INDICES À RECHERCHER :
- "DPE", "diagnostic de performance énergétique", "classe énergétique"
- "amiante", "dossier technique amiante", "DTA"
- "annexe environnementale", "annexe verte", "bail vert"
- "état des risques", "ERP", "ERNMT", "risques naturels"

EXEMPLES :
- "DPE classe D établi le 15/03/2024, annexé au présent bail"
  → hasDPE: true, dpeNote: "D"
- "L'annexe environnementale prévue par le décret du 30 décembre 2011 est jointe"
  → hasEnvironmentalAnnex: true

Format de sortie JSON conforme à EnvironmentalAnnexesData.`

export const OTHER_ANNEXES_PROMPT = `Extraire les autres annexes au bail.

CHAMPS À EXTRAIRE :

- hasInternalRegulations : Règlement intérieur de l'immeuble (true/false)
- hasPremisesPlan : Plan des locaux (true/false)
- hasChargesInventory : Inventaire des charges récupérables (true/false)
  - Liste des charges imputables au preneur
- hasAnnualChargesSummary : Récapitulatif annuel des charges (true/false)
  - Historique des 3 dernières années
- hasThreeYearWorksBudget : Budget prévisionnel travaux sur 3 ans (true/false)
- hasPastWorksSummary : Récapitulatif des travaux passés (true/false)

INDICES À RECHERCHER :
- "règlement intérieur", "règlement de copropriété"
- "plan des locaux", "plan annexé"
- "liste des charges", "inventaire des charges récupérables"
- "récapitulatif des charges", "décompte annuel"
- "budget prévisionnel", "travaux programmés"

EXEMPLES :
- "Le règlement intérieur de l'immeuble est annexé aux présentes"
  → hasInternalRegulations: true
- "Annexe 3 : Plan des locaux loués"
  → hasPremisesPlan: true

Format de sortie JSON conforme à OtherAnnexesData.`

export const OTHER_PROMPT = `Extraire les autres informations importantes.

CHAMPS À EXTRAIRE :

1. SIGNATURE :
- isSignedAndInitialed : Bail signé et paraphé par les parties (true/false)
  - Vérifier les mentions de signature en fin de document

2. DÉROGATIONS :
- civilCodeDerogations : Dérogations au Code civil (tableau de chaînes)
  - Articles du Code civil auxquels il est dérogé
- commercialCodeDerogations : Dérogations au Code de commerce (tableau de chaînes)
  - Clauses dérogatoires au statut des baux commerciaux

INDICES À RECHERCHER :
- "Fait à..., le...", "Signature des parties"
- "Lu et approuvé", "Bon pour accord"
- "Par dérogation à l'article...", "Nonobstant les dispositions de..."
- "Les parties conviennent expressément de déroger à..."

DÉROGATIONS COURANTES :
- Code civil : articles 1719 à 1762 (obligations bailleur/preneur)
- Code de commerce : L.145-1 et suivants (statut des baux commerciaux)
  - Ex: droit de préemption, indemnité d'éviction, renouvellement

EXEMPLES :
- "Par dérogation à l'article 1724 du Code civil, le preneur ne pourra prétendre à aucune réduction de loyer en cas de travaux"
  → civilCodeDerogations: ["Article 1724 - pas de réduction de loyer pour travaux"]
- "Fait en deux exemplaires originaux à Paris, le 15 mars 2024"
  → isSignedAndInitialed: true (présomption de signature si mention "Fait à")

Format de sortie JSON conforme à OtherData.`

export interface ExtractionPrompt {
  section: string
  prompt: string
  retryable: boolean
}

export const EXTRACTION_PROMPTS: ExtractionPrompt[] = [
  { section: "regime", prompt: REGIME_PROMPT, retryable: true },
  { section: "parties", prompt: PARTIES_PROMPT, retryable: true },
  { section: "premises", prompt: PREMISES_PROMPT, retryable: true },
  { section: "calendar", prompt: CALENDAR_PROMPT, retryable: true },
  {
    section: "supportMeasures",
    prompt: SUPPORT_MEASURES_PROMPT,
    retryable: true,
  },
  { section: "rent", prompt: RENT_PROMPT, retryable: true },
  { section: "indexation", prompt: INDEXATION_PROMPT, retryable: true },
  { section: "taxes", prompt: TAXES_PROMPT, retryable: true },
  { section: "charges", prompt: CHARGES_PROMPT, retryable: true },
  { section: "insurance", prompt: INSURANCE_PROMPT, retryable: true },
  { section: "securities", prompt: SECURITIES_PROMPT, retryable: true },
  { section: "inventory", prompt: INVENTORY_PROMPT, retryable: true },
  { section: "maintenance", prompt: MAINTENANCE_PROMPT, retryable: true },
  { section: "restitution", prompt: RESTITUTION_PROMPT, retryable: true },
  { section: "transfer", prompt: TRANSFER_PROMPT, retryable: true },
  {
    section: "environmentalAnnexes",
    prompt: ENVIRONMENTAL_ANNEXES_PROMPT,
    retryable: true,
  },
  { section: "otherAnnexes", prompt: OTHER_ANNEXES_PROMPT, retryable: true },
  { section: "other", prompt: OTHER_PROMPT, retryable: true },
]
