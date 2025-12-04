import type { ExtractionSection } from "./types"

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
- N'utilise JAMAIS d'anglais dans tes réponses (pas de "not found", "missing", "not specified", etc.).

VALEUR PAR DÉFAUT POUR LES INFORMATIONS ABSENTES :
- RÈGLE ABSOLUE : Si une information n'est PAS trouvée dans le document, utilise TOUJOURS "Non mentionné".
- Cette règle s'applique à TOUS les champs : rawText, descriptions textuelles, valeurs de type chaîne.
- FORMAT EXACT : "Non mentionné" (avec majuscule N et M, sans guillemets dans la valeur JSON)

EXEMPLES DE BONNES PRATIQUES :
- ❌ MAUVAIS : "non précisé", "absent du document", "non indiqué", "N/A", "non trouvé", "pas mentionné"
- ✅ BON : "Non mentionné"
- ❌ MAUVAIS : rawText: "Aucune information trouvée"
- ✅ BON : rawText: "Non mentionné"
- ❌ MAUVAIS : value: null, rawText: "absent"
- ✅ BON : value: null, rawText: "Non mentionné"

PRINCIPES FONDAMENTAUX :
- Extraire UNIQUEMENT les informations explicitement présentes dans le document.
- Ne JAMAIS inventer, déduire de connaissances externes, ou deviner des valeurs manquantes.
- Il est TOUJOURS préférable de retourner null (avec confidence "missing") qu'une valeur imprécise ou spéculative.
- Pour les champs manquants : value = null, confidence = "missing", rawText = "Non mentionné"

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

EXEMPLES DE FORMAT DE SORTIE :

1. Information trouvée :
{
  "value": "Bail commercial",
  "confidence": "high",
  "source": "page 1",
  "rawText": "BAIL COMMERCIAL entre les soussignés"
}

2. Information NON trouvée (VALEUR PAR DÉFAUT) :
{
  "value": null,
  "confidence": "missing",
  "source": "Document entier",
  "rawText": "Non mentionné"
}

3. Information partielle ou ambiguë :
{
  "value": null,
  "confidence": "missing",
  "source": "section X",
  "rawText": "Non mentionné"
}

IMPORTANT : Même si value = null, rawText doit TOUJOURS contenir "Non mentionné" (pas de chaîne vide, pas d'autre texte).

Tu recevras le texte complet du document et devras extraire des sections spécifiques.`

export const REGIME_PROMPT = `Extraire le régime juridique du bail.

VALEURS POSSIBLES (utiliser ces formulations exactes) :
- "Bail commercial" : Bail commercial classique (L.145-1 et suivants du Code de commerce)
- "Bail civil" : Bail de droit commun (Code civil)
- "Convention d'occupation précaire" : Convention d'occupation précaire
- "Bail dérogatoire" : Bail dérogatoire (≤ 3 ans, article L.145-5)
- "Bail à construire" : Bail à construire
- "Bail à construction" : Bail à construction (emphytéotique)
- "BEFA" : Bail en l'État Futur d'Achèvement
- "unknown" : Type non identifiable (utiliser cette valeur exacte)

INDICES À RECHERCHER :
- Titre du document : "BAIL COMMERCIAL", "CONTRAT DE BAIL", etc.
- Références légales : "L.145-1", "Code de commerce", "statut des baux commerciaux"
- Durée : Un bail de 3/6/9 ans suggère un bail commercial
- Mentions explicites : "bail dérogatoire", "convention précaire"
- "donne à bail commercial" dans le texte

EXEMPLES :
- "Le présent BAIL COMMERCIAL est consenti..." → regime: "Bail commercial"
- "statut des baux commerciaux" → regime: "Bail commercial"
- "Convention d'occupation précaire..." → regime: "Convention d'occupation précaire"
- "Bail dérogatoire de 23 mois en application de l'article L.145-5..." → regime: "Bail dérogatoire"

IMPORTANT - Format de sortie EXACT :
{
  "regime": {
    "value": "Bail commercial",
    "confidence": "high",
    "source": "page X ou section Y",
    "rawText": "extrait du texte"
  }
}`

export const PARTIES_PROMPT = `Extraire les informations sur toutes les parties au contrat.

PARTIES À IDENTIFIER :
1. Bailleur (propriétaire) : personne physique ou morale qui loue le bien
2. Représentant du bailleur (UNIQUEMENT si mandataire externe) : administrateur de biens, société de gestion
   - NE PAS inclure : le gérant/président qui signe pour la société (c'est un représentant légal, pas un mandataire)
   - NE PAS inclure : une personne qui "représente" la société pour signer
   - INCLURE UNIQUEMENT : un tiers mandaté (ex: agence immobilière, administrateur de biens externe)
3. Preneur (locataire) : personne physique ou morale qui prend le bien en location

INFORMATIONS À EXTRAIRE POUR CHAQUE PARTIE :
- name : Nom complet (personne physique) ou dénomination sociale (société)
- siren : Numéro SIREN (9 chiffres) ou SIRET (14 chiffres) de la société
- email : Adresse email (IMPORTANT : chercher dans section "Notifications")
- phone : Numéro de téléphone
- address : Adresse postale complète (siège social pour les sociétés)

EXTRACTION DU SIREN/SIRET :
- Le SIREN est un identifiant à 9 chiffres : XXX XXX XXX
- Le SIRET est un identifiant à 14 chiffres : XXX XXX XXX XXXXX
- Chercher dans : "RCS", "SIRET", "SIREN", "immatriculée sous le numéro"
- Format possible : "123 456 789", "123456789", "RCS Paris 123 456 789"
- Extraire uniquement les chiffres, sans espaces

GESTION DES NOMS ILLISIBLES OU MASQUÉS :
L'OCR peut produire du texte illisible pour les noms des parties :
- Caractères remplacés par des symboles : "@@@", "###", "***", "EEEE", "XXXX"
- Texte corrompu : "La i son si¢ge socia!", "Ee: 2. capital dc"
Dans ces cas :
- Si le texte est partiellement lisible, extraire ce qui est lisible
- Si le texte est totalement corrompu, retourner null avec confidence "missing"
- Mentionner dans rawText : "nom masqué ou illisible dans le document"

OÙ CHERCHER LES EMAILS ET TÉLÉPHONES (PRIORITAIRE) :
1. ARTICLE "NOTIFICATIONS" ou "CORRESPONDANCES" - chercher en priorité ici !
   - Termes : "toute notification", "toute correspondance", "adresse électronique"
   - Souvent situé vers la fin du bail (articles 20-30)
2. En-tête ou pied de page du document
3. Après le nom des parties dans le préambule
4. Dans les annexes ou conditions particulières
- Format email : xxx@xxx.xx (attention OCR : @ peut devenir "a", "©", "(a)")
- Format téléphone : 01 XX XX XX XX, +33 X XX XX XX XX, 06.XX.XX.XX.XX

INDICES COURANTS POUR IDENTIFIER LES PARTIES :
- "ENTRE LES SOUSSIGNÉS :", "D'UNE PART :", "D'AUTRE PART :"
- "ci-après dénommé le Bailleur / le Preneur"
- Forme juridique : SCI, SARL, SAS, SA, EURL, etc.
- RCS, SIRET, SIREN, capital social
- "domicile élu", "adresse de notification"

EXEMPLES :
- "La SCI IMMOBILIER, RCS Paris 123 456 789, dont le gérant est M. Jean DUPONT"
  → landlord.name: "SCI IMMOBILIER", landlord.siren: "123456789"
  → landlordRepresentative: null (le gérant n'est pas un mandataire externe)
- "La SCI IMMOBILIER, représentée par la société GESTION IMMO, administrateur de biens"
  → landlord.name: "SCI IMMOBILIER", landlordRepresentative.name: "GESTION IMMO"
- "Article 25 - Notifications : par email à contact@exemple.fr pour le Bailleur"
  → landlord.email: "contact@exemple.fr"
- Email non trouvé dans le document
  → landlord.email: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }
- "La société @@@@@, au capital de..." (nom masqué)
  → name: { value: null, confidence: "missing", source: "...", rawText: "Non mentionné" }

FORMAT DE SORTIE :
{
  "landlord": {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "siren": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "email": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "address": { "value": "..." ou null, "confidence": "...", "source": "..." }
  },
  "landlordRepresentative": null ou {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "siren": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "email": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "address": { "value": "..." ou null, "confidence": "...", "source": "..." }
  },
  "tenant": {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "siren": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "email": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." ou null, "confidence": "...", "source": "..." },
    "address": { "value": "..." ou null, "confidence": "...", "source": "..." }
  }
}`

export const PREMISES_PROMPT = `Extraire la description détaillée des locaux loués.

CHAMPS À EXTRAIRE :

1. DÉSIGNATION ET DESTINATION :
- designation : Description générale des locaux loués
  - Format : "[Type de local] et [éléments annexes]"
  - Ex: "Local mixte activités/bureaux et 4 places de parking (n°1,2,3,4)"
  - Inclure les éléments loués : bâtiments, parkings, caves, etc.
  - Chercher dans l'article "DÉSIGNATION" ou "DÉFINITION DES LOCAUX"
  
- purpose (destination) : Usage autorisé des locaux
  - ⚠️ TOUJOURS commencer par "Usage exclusif de" ou "Usage de" si mentionné comme tel
  - Format attendu : "Usage exclusif d'[activité]" ou "Usage de [activité]. Exclusion : [activités interdites]"
  - Chercher dans article "DESTINATION"
  - Termes : "à usage exclusif de", "qu'à usage de", "destiné à"
  - Ex: "Usage exclusif d'activités/bureaux"
  - Ex: "Usage de bureaux. Exclusion : réception du public"
  
- address : Adresse des locaux (ville et code postal)
  - Format préféré : "[Ville] [Code postal]" ou adresse complète
  - Ex: "Les Pennes Mirabeau 13170" ou "10, Rue Guy de Maupassant 13170 LES PENNES MIRABEAU"

2. CARACTÉRISTIQUES DU BÂTIMENT :
- buildingYear : Année de construction (important pour diagnostics amiante si avant 1997)
  - Si non mentionné, retourner "Non mentionné"
- floors : Étages concernés (liste : ["RDC", "1er", "2ème", etc.])
  - Si non mentionné, retourner "Non mentionné"
- lotNumbers : Numéros de lot (copropriété)
  - Format : "Lots X, Y, Z" ou "Non mentionné"

3. SURFACES :
- surfaceArea : Surface TOTALE en m² des locaux loués (VALEUR NUMÉRIQUE UNIQUEMENT)
  
  RÈGLES IMPORTANTES :
  - Retourner UNIQUEMENT le nombre, sans unité (ex: 218 et non "218 m²")
  - Si plusieurs surfaces sont données (bureaux: X m², activités: Y m²), les ADDITIONNER
  - Si pas de total explicite mais des surfaces détaillées, les additionner
  - Privilégier : "surface totale", "surface exploitée", "superficie totale"
  
  CORRECTION DES ERREURS OCR :
  - "m?" → "m²", "m'" → "m²", "m 2" → "m²", "m2" → "m²"
  - Les points dans les nombres (3.613) sont des séparateurs de milliers = 3613
  
  EXEMPLES :
  - "surface totale de 218 m²" → surfaceArea: 218
  - "Bureaux : 278 m² et 41 m², Activités : 117 m² et 542 m²" → surfaceArea: 978
  - "0 m²" ou surface non trouvée → mentionner dans rawText les surfaces partielles trouvées

4. AMÉNAGEMENTS :
- isPartitioned : Locaux cloisonnés ?
  - Valeurs : "Oui, [détails]" / "Non" / "Non mentionné"
  - Ex: "Oui, plusieurs salles de réunion notamment"
  - Chercher dans article "DESIGNATION" ou "CLAUSE SUSPENSIVE" (travaux préalables)
  
- hasFurniture : Présence de mobilier FOURNI par le bailleur ?
  - Valeurs : "Oui" / "Non" / "Non mentionné"
  - ATTENTION : Ne pas confondre avec la clause de garnissement (obligation du preneur)
  - Si pas de mobilier fourni explicitement mentionné → "Non"
  
- furnishingConditions (CLAUSE DE GARNISSEMENT - RECHERCHE ACTIVE) :
  ⚠️ Cette clause est TRÈS COURANTE, chercher dans article "MODALITÉS D'OCCUPATION"
  - Mots-clés : "garnir", "tenir garnis", "meubles, objets mobiliers"
  - Formulation type : "Garnir et tenir constamment garnis les lieux loués de meubles, objets mobiliers, et matériels de bureau en quantité et de valeur suffisantes"
  - Si présent : extraire la clause complète
  - Format attendu : "Oui, garnir et tenir constamment garnis les lieux loués de meubles, objets mobiliers, et matériels de bureau en quantité et de valeur suffisantes"
  - Si vraiment absent : "Non mentionné"
  
- signageConditions : Conditions d'enseigne/signalétique
  - Chercher article "MODALITÉS D'OCCUPATION" ou "TRAVAUX"
  - Mots-clés : "plaque", "store", "enseigne", "aspect extérieur", "autorisation préalable"
  - Ex: "Autorisation préalable et écrite du bailleur requise pour toute plaque ou installation affectant l'aspect extérieur"
  - Si absent : "Non mentionné"

5. ESPACES ANNEXES :
- hasOutdoorSpace : Espace extérieur (terrasse, cour) - "Oui" / "Non" (non mentionné = Non)
- hasArchiveSpace : Local d'archives - "Oui" / "Non" (non mentionné = Non)
- parkingSpaces : Nombre de places de parking voitures (nombre entier, 0 si absent)
- twoWheelerSpaces : Places deux-roues motorisés
- bikeSpaces : Places vélos

6. TANTIÈMES / QUOTE-PART :
- shareWithCommonAreas : Quote-part parties communes
  - Format : valeur ou "Non mentionné"
- shareWithoutCommonAreas : Quote-part hors parties communes
  - Format : valeur ou "Non mentionné"
- totalBuildingShare : Tantièmes sur l'ensemble de l'immeuble

EXEMPLES COMPLETS :
- "Local mixte activités/bureaux d'une surface de 218 m² et 4 places de parking"
  → designation: "Local mixte activités/bureaux et 4 places de parking (n°1,2,3,4)"
  → surfaceArea: 218, parkingSpaces: 4
- "À usage exclusif de bureaux, à l'exclusion de toute activité de réception du public"
  → purpose: "Usage exclusif de bureaux. Exclusion : activité de réception du public"
- Année de construction non mentionnée dans le document
  → buildingYear: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }
- Étages non mentionnés
  → floors: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }
- Clause d'enseigne absente
  → signageConditions: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }

Format de sortie JSON avec tous les champs ayant value, confidence, source.
IMPORTANT : 
- surfaceArea doit être un NOMBRE, pas une chaîne avec unité.
- Pour TOUS les champs manquants : value = null, rawText = "Non mentionné" (exactement cette formulation).`

export const CALENDAR_PROMPT = `Extraire toutes les dates et durées liées au bail.

CHAMPS À EXTRAIRE :

1. DATES CLÉS :
- signatureDate : Date de signature du bail (format ISO : YYYY-MM-DD)
  - Se trouve généralement en fin de bail, avant les annexes, avec "Fait à..."
  - Si non trouvée : "Non mentionné"
- effectiveDate : Date de prise d'effet / entrée en jouissance
- earlyAccessDate : Date de mise à disposition anticipée (si différente de effectiveDate)
- endDate : Date de fin du bail
  - IMPORTANT : la date de fin est la VEILLE de l'anniversaire, pas le jour même
  - Exemple : bail du 10/10/2025 pour 10 ans → fin le 09/10/2035 (J-1)

2. DURÉE :
- duration : Durée du bail en années (nombre entier : 3, 6, 9, 10, 12...)
  - Format de sortie : "X ans" (ex: "9 ans", "10 ans")

3. ÉCHÉANCES :
- nextTriennialDate : Prochaine échéance triennale
  - IMPORTANT : l'échéance est la VEILLE de l'anniversaire triennal
  - Exemple : bail du 10/10/2025 → première échéance le 09/10/2028 (J-1 du 3ème anniversaire)
  - Ne PAS calculer toi-même si non explicitement mentionnée

4. PRÉAVIS ET RÉSILIATION :
- noticePeriod : Durée du préavis avec contexte
  - Format préféré : "[X] mois avant l'échéance triennale" ou "[X] mois à l'avance"
  - Ex: "6 mois avant l'échéance triennale" ✅ (plus précis que juste "6 mois")
  - Chercher dans article "DURÉE" ou "CONGÉ"
  
- terminationConditions : Modalités pour donner congé
  - Format attendu : "Pour le preneur : [moyen]. Pour le bailleur : [moyen]"
  - Ex: "Pour le preneur : par lettre recommandée AR ou acte extrajudiciaire. Pour le bailleur : par acte extrajudiciaire"
  - Chercher : RAR, acte de commissaire de justice, acte extrajudiciaire
  
- renewalConditions : Conditions de renouvellement à l'échéance
  - Chercher dans article "renouvellement" ou "fin de bail"
  - Si aucune clause explicite : "Non mentionné dans le bail"
  - Ne pas inventer de conditions

IMPORTANT - CALCUL DES DATES (J-1) :
- La date de fin de bail et les échéances triennales sont calculées comme la VEILLE de l'anniversaire
- Bail commençant le 19/12/2016 pour 9 ans : fin le 18/12/2025 (pas le 19/12/2025)
- Bail commençant le 10/10/2025 : 1ère échéance triennale le 09/10/2028

ATTENTION AUX FORMATS DE DATE :
- Formats français : "1er janvier 2024", "01/01/2024", "1 janvier 2024"
- OCR peut altérer : "1er" → "1 er", "janvier" → "janvler"

EXEMPLES :
- "bail de 9 ans à compter du 19 décembre 2016"
  → duration: "9 ans", effectiveDate: "2016-12-19", endDate: "2025-12-18"
- "préavis de six mois avant l'échéance par lettre recommandée AR"
  → noticePeriod: "6 mois", terminationConditions: "Par lettre recommandée AR"
- "renouvellement pour 9 ans au loyer de marché"
  → renewalConditions: "Durée : 9 ans. Loyer : valeur locative de marché"
- Date de signature non trouvée dans le document
  → signatureDate: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }
- Conditions de renouvellement absentes
  → renewalConditions: { value: null, confidence: "missing", source: "Document entier", rawText: "Non mentionné" }

Format de sortie JSON avec dates en format ISO (YYYY-MM-DD).
IMPORTANT : Pour les champs manquants, rawText doit être "Non mentionné" (exactement cette formulation).`

export const SUPPORT_MEASURES_PROMPT = `Extraire les mesures d'accompagnement accordées au preneur.

CHAMPS À EXTRAIRE :

1. FRANCHISE DE LOYER :
- hasRentFreeperiod : Présence d'une franchise de loyer (true/false)
- rentFreePeriodDescription : Description de la franchise
  ⚠️ FORMAT PRÉFÉRÉ : Décrire la PÉRIODE plutôt que le calcul
  - PRIVILÉGIER : "Franchise de loyer consentie jusqu'au [date]"
  - OU : "[X] mois de franchise à compter de [date]"
  - Ex: "Franchise de loyer consentie jusqu'au 8 janvier 2017"
  - Ex: "6 mois de franchise à compter de la date d'effet"
  - ❌ ÉVITER : "0.6 mois soit 840 €" (trop calculé, pas lisible)
  
- rentFreePeriodMonths : Nombre de mois de franchise
  - Si franchise exprimée en jours/date : calculer en mois (arrondi 1 décimale)
  - Ex: du 19/12/2016 au 08/01/2017 ≈ 0.6 mois
  
- rentFreePeriodAmount : Montant total de la franchise en euros HT
  - SEULEMENT si explicitement mentionné dans le bail
  - Sinon laisser null (sera calculé automatiquement)

2. AUTRES MESURES D'ACCOMPAGNEMENT :
- hasOtherMeasures : Présence d'autres mesures d'accompagnement (true/false)
- otherMeasuresDescription : Description des autres mesures
  ⚠️ FORMAT PRÉFÉRÉ : Résumer puis renvoyer à l'article du bail
  - Ex: "Divers aménagements à la charge du bailleur (installation de stores, création d'un second espace vitré, création d'une salle de réunion, câblage électrique et informatique, etc.). Pour plus de précision, cf. article 8 du bail."
  - ❌ ÉVITER : Liste exhaustive de tous les travaux
  
  Types de mesures à rechercher :
  - Contribution aux travaux d'aménagement du preneur (avec montant si indiqué)
  - Aménagements réalisés par le bailleur (résumer les principaux + renvoyer à l'article)
  - Prise en charge de frais de déménagement
  - Réduction temporaire de loyer (paliers progressifs)
  
INDICES À RECHERCHER :
- "franchise de loyer", "exemption de loyer", "gratuité de loyer"
- "mesures d'accompagnement", "avantages consentis"
- Article ou sous-article "mesures d'accompagnement" dans la section loyer
- "participation aux travaux", "contribution du bailleur", "à la charge du bailleur"
- "paliers de loyer", "loyer progressif"

OÙ CHERCHER :
- Article "Loyer" et ses sous-articles
- Article dédié "Mesures d'accompagnement"
- Article "Travaux" (pour les aménagements bailleur)

EXEMPLES :
- "Franchise de 6 mois à compter de la date d'effet soit 56 235 € + 4 mois à compter du 36ème mois"
  → hasRentFreeperiod: true
  → rentFreePeriodDescription: "6 mois applicable à la date d'effet pour 56 235 €HT + 4 mois à compter du 36ème mois"
  → rentFreePeriodMonths: 10
  
- "Le bailleur versera au preneur 50.000 € HT pour ses travaux d'aménagement"
  → hasOtherMeasures: true
  → otherMeasuresDescription: "Contribution aux travaux d'aménagement du preneur pour un montant de 50 000 €HT"

- "Franchise jusqu'au 8 janvier 2017, soit 0.6 mois"
  → hasRentFreeperiod: true
  → rentFreePeriodDescription: "Franchise de loyer consentie jusqu'au 8 janvier 2017"
  → rentFreePeriodMonths: 0.6

Format de sortie JSON conforme à SupportMeasuresData.`

export const RENT_PROMPT = `Extraire toutes les informations relatives au loyer.

CHAMPS À EXTRAIRE :

1. LOYER PRINCIPAL (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, sans symbole)
  IMPORTANT - CAS DU LOYER PROGRESSIF :
  - Si le bail prévoit un loyer différent par année (ex: 79000€ en 2016, 82000€ en 2017...)
  - Extraire le loyer de la PREMIÈRE ANNÉE (loyer initial)
  - Mentionner dans rawText que le loyer est progressif avec les détails
- quarterlyRentExclTaxExclCharges : Loyer trimestriel HTHC (SEULEMENT si explicite)
- annualRentPerSqmExclTaxExclCharges : Loyer annuel au m² HTHC (SEULEMENT si explicite)
  - Ne PAS calculer : sera déduit automatiquement si absent

2. LOYER PARKING :
- annualParkingRentExclCharges : Loyer annuel parkings HTHC
  - Si le loyer parking n'est PAS mentionné séparément : "Inclus dans le loyer initial des locaux"
  - Si explicitement 0 ou gratuit : 0
  - Sinon extraire le montant
- quarterlyParkingRentExclCharges : Loyer trimestriel parkings
  - Si non mentionné séparément : "Inclus dans le loyer initial des locaux"
- annualParkingRentPerUnitExclCharges : Loyer par place
  - Si non mentionné séparément : "Inclus dans le loyer"
  - Ne PAS calculer : sera déduit automatiquement si explicite

3. TVA ET MODALITÉS :
- isSubjectToVAT : Assujettissement à la TVA (true/false)
  - Rechercher : "option pour la TVA", "assujetti à la TVA", "TVA applicable"
- paymentFrequency : Description de la périodicité de paiement
  - Format attendu : "[Fréquence] [modalité]"
  - Ex: "Trimestriel d'avance", "Premier jour ouvrable de chaque trimestre"
  - "terme à échoir" / "d'avance" = paiement au début de la période
  - "terme échu" = paiement en fin de période
  INDICES POUR LA FRÉQUENCE :
  - "trimestriellement", "par trimestre", "chaque trimestre" → Trimestriel
  - "mensuellement", "par mois", "chaque mois" → Mensuel
  - "annuellement", "par an" → Annuel

4. PÉNALITÉS DE RETARD :
- latePaymentPenaltyConditions : Description COMPLÈTE des conditions de pénalités
  - Inclure : délai avant application, moyens de notification, montant/taux
  - Format : "[Taux/montant] [conditions d'application]"
  - Chercher dans article "sanctions", "pénalités", "retard de paiement"
  - Ex: "10% de toutes les sommes exigibles à l'expiration d'un délai de 15 jours"
  - Ex: "Taux de base bancaire + 3 points après mise en demeure par RAR restée 8 jours sans suite"
- latePaymentPenaltyAmount : Montant ou taux des pénalités (valeur uniquement)

INDICES COURANTS :
- "Le loyer annuel est fixé à...", "soit un loyer de X € HT/an"
- "payable par trimestre", "terme à échoir", "terme échu"
- "€ HT", "hors taxes", "HTHC", "hors taxes et hors charges"
- "intérêts de retard au taux légal majoré de X points"
- "clause pénale", "indemnité forfaitaire"

ATTENTION AUX CONFUSIONS :
- Loyer HT vs TTC (toujours extraire HT)
- Loyer charges comprises vs hors charges (toujours extraire HC)
- Loyer mensuel vs trimestriel vs annuel

EXEMPLES :
- "Loyer annuel : 120.000 € HT HC, payable trimestriellement d'avance"
  → annualRent: 120000, quarterlyRent: 30000, paymentFrequency: "Trimestriel d'avance"
- Loyer 16800€ sans mention parking séparé avec 4 parkings
  → annualRent: 16800, annualParkingRent: "Inclus dans le loyer initial des locaux"
- "À défaut de paiement, 10% des sommes dues après 15 jours"
  → latePaymentPenaltyConditions: "10% de toutes les sommes exigibles à l'expiration d'un délai de 15 jours"

Format : valeurs numériques SANS symbole € ni séparateurs de milliers.`

export const INDEXATION_PROMPT = `Extraire les clauses d'indexation du loyer.

CHAMPS À EXTRAIRE :

1. CLAUSE ET TYPE :
- hasIndexationClause : Présence d'une clause d'indexation
  - Valeurs EXACTES : "Oui" ou "Non" (pas true/false)
  
- indexationType : Type d'indice utilisé
  - RETOURNER UNIQUEMENT L'ACRONYME : "ILC" / "ILAT" / "ICC"
  - "ILC" : Indice des Loyers Commerciaux (le plus courant)
  - "ILAT" : Indice des Loyers des Activités Tertiaires
  - "ICC" : Indice du Coût de la Construction (ancien)

2. RÉFÉRENCES ET FRÉQUENCE :
- referenceQuarter : Trimestre de référence avec indice type et valeur si disponible
  - Format AVEC valeur : "Dernier indice publié à la date d'effet soit ILC 2T2016 à 108,40"
  - Format SANS valeur : "ILC 2ème trimestre 2016" ou "ILC 2T2016"
  - Chercher : "indice de base", "indice de référence", valeur numérique (ex: 108,40)
  
- firstIndexationDate : Date RÉCURRENTE de l'indexation (pas une date unique)
  ⚠️ FORMAT OBLIGATOIRE : "Le [jour] [mois] de chaque année"
  - Ex: "Le 19 décembre de chaque année"
  - Ex: "À chaque date anniversaire du bail"
  - ❌ NE PAS donner une date unique comme "19 décembre 2017" ou "2017-12-19"
  
- indexationFrequency : Fréquence de l'indexation
  ⚠️ VALEURS EXACTES EN FRANÇAIS :
  - "Annuellement" (pas "Annuel", pas "annual")
  - "Trimestriellement" (pas "Trimestriel")
  - Chercher : "tous les ans", "chaque année", "à la date anniversaire"

EXEMPLES :
- "Le loyer sera indexé... tous les ans, à la date anniversaire de la prise d'effet du bail"
  → firstIndexationDate: "Le 19 décembre de chaque année" (si prise d'effet le 19/12)
  → indexationFrequency: "Annuellement"
  
- "indice du 2ème trimestre 2016 (indice de base)"
  → referenceQuarter: "ILC 2ème trimestre 2016" ou avec valeur si mentionnée

Format de sortie JSON conforme à IndexationData.`

export const TAXES_PROMPT = `Extraire les informations sur les impôts et taxes.

CHAMPS À EXTRAIRE :

1. REFACTURATION DES TAXES AU PRENEUR :
- propertyTaxRebilled : Refacturation de la taxe foncière et TEOM au preneur
  FORMAT DE RÉPONSE : Description textuelle de ce qui est refacturé
  - Ex: "le Preneur devra par ailleurs rembourser au Bailleur : la taxe d'enlèvement des ordures ménagères, la quote-part de taxe foncière afférente aux Locaux Loués"
  - Ex: "Oui" (si simplement mentionné que c'est à la charge du preneur)
  - Ex: "Non mentionné" (si pas de clause)
  
  INDICES : "taxe foncière à la charge du preneur", "refacturation", "rembourser au Bailleur"

2. PROVISIONS POUR TAXES (montants si mentionnés) :
- propertyTaxAmount : Provision annuelle pour taxe foncière (en euros)
  - Retourner "Non mentionné" si pas de montant indiqué
- teomAmount : Provision annuelle pour TEOM (en euros)
  - Retourner "Non mentionné" si pas de montant indiqué
- officeTaxAmount : Provision annuelle pour taxe bureaux (en euros, IDF uniquement)
  - Retourner "Non mentionné" si pas de montant indiqué
- parkingTaxAmount : Provision annuelle pour taxe sur emplacements de parking
  - Retourner "Non mentionné" si pas de montant indiqué

ATTENTION - MONTANTS PAR M² vs MONTANTS TOTAUX :
- Si le document donne "40 €/m²" ou "17 euros HT par m2", ceci est un montant PAR M²
- Les champs doivent contenir les montants TOTAUX annuels
- Si seul le montant par m² est donné : retourner "Non mentionné" et mentionner le montant par m² dans rawText

OÙ CHERCHER :
- Article "charges" ou sous-article "charges"
- Annexe "état récapitulatif des charges"
- Article sur les obligations financières du preneur

INDICES À RECHERCHER :
- "taxe foncière", "contribution foncière"
- "TEOM", "taxe d'enlèvement des ordures ménagères", "ordures ménagères"
- "taxe sur les bureaux", "TSB"
- "à la charge du preneur", "supportée par le locataire"
- "provision", "acompte"

EXEMPLES :
- "Le preneur remboursera la taxe foncière et la TEOM"
  → propertyTaxRebilled: "Oui, taxe foncière et TEOM à la charge du preneur"
  → propertyTaxAmount: "Non mentionné", teomAmount: "Non mentionné"

- "Provision annuelle pour taxe foncière : 2.040 €"
  → propertyTaxAmount: 2040

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
- securityDepositDescription : Description COMPLÈTE du dépôt de garantie
  ⚠️ FORMAT OBLIGATOIRE : "[Nombre] mois de loyer hors taxes hors charges soit [montant] €"
  - TOUJOURS inclure :
    1. Le nombre de mois (ex: "3 mois")
    2. La précision "hors taxes hors charges" ou "HT HC"
    3. Le montant en euros (ex: "soit 4200 €")
  - Ex: "3 mois de loyer hors taxes hors charges soit 4200 €"
  - Ex: "3 mois de loyer HT HC soit 28 117,5 €"
  - ❌ NE PAS retourner seulement le montant : "4200 €"
  
- securityDepositAmount : Montant numérique du dépôt de garantie (en euros, sans symbole)
  - Extraire uniquement le nombre : 4200 (pas "4200 €", pas "4 200")
  - Si non calculable : null

⚠️ ATTENTION - NE PAS CONFONDRE AVEC LE DÉPÔT DE GARANTIE :
- Les clauses de RECONSTITUTION du dépôt de garantie → À INCLURE dans securityDepositDescription
- Les conditions de RESTITUTION du dépôt → À INCLURE dans securityDepositDescription
- La garantie solidaire en cas de CESSION du bail → Ce n'est PAS une sûreté du bail initial
- Seules les garanties VRAIMENT ADDITIONNELLES au dépôt vont dans otherSecurities

2. AUTRES SÛRETÉS (garanties additionnelles au dépôt) :
- otherSecurities : Liste des autres garanties (tableau de chaînes)
  
  ⚠️ TYPES DE VRAIES SÛRETÉS ADDITIONNELLES :
  - Cautionnement solidaire d'un TIERS (société mère, personne physique)
    Ex: "Cautionnement solidaire émanant de [Société Mère] (Annexe X)"
  - Garantie bancaire à première demande (GAPD)
  - Caution personnelle du dirigeant
  - Nantissement de fonds de commerce
  
  ⚠️ CE QUI N'EST PAS UNE "AUTRE SÛRETÉ" :
  - "Reconstitution du dépôt de garantie" → NON, c'est une modalité du DG
  - "Garantie solidaire du cédant" en cas de cession → NON, c'est une clause de cession
  - "Assurances du preneur" → NON, c'est une obligation d'assurance
  
  Si AUCUNE vraie sûreté additionnelle : "Non"

INDICES À RECHERCHER :
- Article ou sous-article "garantie", "dépôt de garantie", "sûretés"
- "caution solidaire", "cautionnement"
- "garantie à première demande", "GAPD"
- "nantissement", "gage"
- Annexes listant les garanties

EXEMPLES :
- "Dépôt de garantie égal à 3 mois de loyer HT HC, soit 4.200 €"
  → securityDepositDescription: "3 mois de loyer hors taxes hors charges soit 4 200 €"
  → securityDepositAmount: 4200
  → otherSecurities: "Non"

- "Dépôt de 28.117,50 € (3 mois) + Cautionnement solidaire de Kouros SA (Annexe 6)"
  → securityDepositDescription: "3 mois de loyer hors taxes hors charges soit 28 117,5 €"
  → securityDepositAmount: 28117.5
  → otherSecurities: ["Cautionnement solidaire émanant de Kouros SA (Annexe 6)"]

- "Le dépôt devra être reconstitué en cas d'utilisation partielle"
  → Ceci va dans securityDepositDescription, PAS dans otherSecurities

Format de sortie JSON avec securityDepositAmount en nombre et otherSecurities en tableau.`

export const INVENTORY_PROMPT = `Extraire les informations sur les états des lieux.

CHAMPS À EXTRAIRE :

1. ÉTAT DES LIEUX D'ENTRÉE :
- entryInventoryConditions : Conditions et modalités (description complète)
  - Mode d'établissement : contradictoire, par huissier/commissaire de justice
  - Répartition des frais : partagés, à charge du preneur/bailleur
  - Référence à un état des lieux antérieur si applicable
  - Ex: "État des lieux établi contradictoirement entre les Parties ou à défaut par huissier; frais partagés"

2. ÉTAT DES LIEUX DE PRÉ-SORTIE :
- hasPreExitInventory : Existence d'un pré-état des lieux
  - Valeurs : "Oui, [délai]" / "Non" / "Non mentionné"
  - Si oui, inclure le délai : "Oui, 3 mois au plus et 1 mois au moins avant le terme du bail"
- preExitInventoryConditions : Conditions détaillées (si applicable)

3. ÉTAT DES LIEUX DE SORTIE :
- exitInventoryConditions : Conditions de l'état des lieux de sortie
  ⚠️ FORMAT ATTENDU : Inclure les DÉLAIS si mentionnés
  - Quand : "au plus tard le jour de l'expiration du bail"
  - Délai de remise en état : "dans un délai de 15 jours" si mentionné
  - Qui paie les réparations
  - Ex: "État des lieux dressé au plus tard le jour de l'expiration du bail. En cas de désordres, si le preneur n'effectue pas spontanément les réparations dans un délai de 15 jours, le bailleur les fera exécuter aux frais du preneur"

OÙ CHERCHER :
- Article "état des lieux" ou "délivrance des locaux"
- Article "restitution des locaux"
- Début de bail pour les conditions d'entrée

INDICES À RECHERCHER :
- "état des lieux", "constat", "procès-verbal"
- "contradictoire", "amiable", "par huissier", "par commissaire de justice"
- "pré-état des lieux", "état des lieux préalable"
- "frais partagés", "à la charge du preneur/bailleur"

EXEMPLES :
- "État des lieux d'entrée établi contradictoirement ou à défaut par huissier, frais partagés"
  → entryInventoryConditions: "État des lieux établi contradictoirement entre les Parties ou à défaut par huissier; frais partagés"
  
- "Un pré-état des lieux sera dressé entre 3 mois et 1 mois avant la fin du bail"
  → hasPreExitInventory: "Oui, 3 mois au plus et 1 mois au moins avant le terme du bail"

Format de sortie JSON conforme à InventoryData.`

export const MAINTENANCE_PROMPT = `Extraire les conditions d'entretien et travaux.

CHAMPS À EXTRAIRE :

1. ENTRETIEN COURANT :
- tenantMaintenanceConditions : Obligations d'entretien du preneur (RÉSUMÉ COURT)
  ⚠️ FORMAT ATTENDU : Une phrase résumant l'obligation principale
  - Ex: "Tenir les lieux loués pendant toute la durée du bail et de ses renouvellements en bon état d'entretien"
  - ❌ NE PAS lister tous les travaux (voir tenantWorksList pour ça)
  - ❌ NE PAS répéter les mêmes infos que tenantWorksList
  - Chercher dans article "ENTRETIEN", "RÉPARATIONS", "MISE EN CONFORMITÉ"

2. RÉPARTITION DES TRAVAUX :
- landlordWorksList : Travaux à la charge du bailleur (tableau CONCIS)
  ⚠️ FORMAT ATTENDU : ["Travaux et grosses réparations définis à l'article 606 du Code civil"]
  - Si article 606 mentionné, c'est souvent la seule ligne nécessaire
  - Ajouter ravalement de façade si explicitement mentionné
  
- tenantWorksList : Travaux à la charge du preneur (tableau structuré)
  ⚠️ FORMAT ATTENDU : 2-3 grandes catégories extraites du bail, pas une liste exhaustive
  - Ex:
    - "Effectuer toutes les réparations qui pourraient être nécessaires, y compris celle découlant de la vétusté et/ou de la force majeure"
    - "Effectuer à ses frais tous travaux prescrits par les autorités administratives"
    - "Travaux soumis à autorisation expresse et écrite du bailleur"
  - ❌ NE PAS copier tout l'article ni mélanger plusieurs articles

3. CLAUSE D'ACCESSION (CRITIQUE - BIEN DISTINGUER) :
- hasAccessionClause : Présence d'une clause d'accession
  - Valeurs : "Oui, [description courte]" / "Non" / "Non mentionné"
  
  ⚠️ DÉFINITION STRICTE : La clause d'accession concerne UNIQUEMENT le TRANSFERT DE PROPRIÉTÉ
  des travaux réalisés par le preneur au bailleur en fin de bail.
  
  CE QU'IL FAUT EXTRAIRE (formulation EXACTE attendue) :
  - "Oui, tous les travaux réalisés par le preneur deviendront la propriété du bailleur sans indemnité à la fin du bail"
  
  ⚠️ CE QUI N'EST PAS UNE CLAUSE D'ACCESSION (NE PAS CONFONDRE) :
  - L'obligation de demander une autorisation pour faire des travaux → NON
  - Les conditions d'exécution des travaux (architecte, assurances) → NON
  - La possibilité pour le bailleur d'exiger la remise en état → NON (c'est l'inverse)
  
  INDICES À RECHERCHER (mots-clés EXACTS) :
  - "deviendront la propriété du bailleur" ← C'EST ÇA
  - "acquerront au bailleur" ← C'EST ÇA
  - "resteront acquis au bailleur" ← C'EST ÇA
  - "sans indemnité à la fin du bail" ← C'EST ÇA
  
  OÙ CHERCHER : Article "TRAVAUX" section "Travaux du preneur", souvent alinéa d)

ARTICLE 606 DU CODE CIVIL (référence pour travaux bailleur) :
- Gros murs, voûtes, planchers
- Poutres, toiture entière

EXEMPLES :
- "Les travaux article 606 du Code civil restent à la charge du bailleur"
  → landlordWorksList: ["Travaux et grosses réparations définis à l'article 606 du Code civil"]
  
- "Tous les travaux réalisés par le preneur deviendront la propriété du bailleur sans indemnité à la fin du présent bail"
  → hasAccessionClause: "Oui, tous les travaux réalisés par le preneur deviendront la propriété du bailleur sans indemnité à la fin du bail"
  
- Clause mentionnant seulement l'autorisation préalable du bailleur pour travaux
  → hasAccessionClause: "Non mentionné" (ce n'est PAS une clause d'accession)

Format de sortie JSON conforme à MaintenanceData.`

export const RESTITUTION_PROMPT = `Extraire les conditions de restitution des locaux.

CHAMPS À EXTRAIRE :

1. RESTITUTION :
- restitutionConditions : Conditions générales de restitution
  FORMAT ATTENDU - résumé concis des obligations :
  - État attendu : "bon état", "très bon état", "configuration initiale"
  - Ex: "Restituer les Locaux Loués dans leur configuration initiale et en très bon état"
  - Ex: "Le preneur devra rendre les locaux loués en bon état d'entretien"

2. REMISE EN ÉTAT :
- restorationConditions : Processus de remise en état
  FORMAT ATTENDU - décrire le processus :
  - Qui établit les devis
  - À la suite de quel événement (pré-état des lieux, état des lieux de sortie)
  - Qui supporte les frais
  
  EXEMPLES :
  - "À la suite du pré-état des lieux contradictoire, le Bailleur fera établir des devis de travaux de remise en état qu'il notifiera au Preneur"
  - "Faculté pour le bailleur d'exiger la remise en état des locaux dans leur état initial à la date de prise d'effet"
  - "Non mentionné" si aucune procédure détaillée

OÙ CHERCHER :
- Article "restitution des locaux"
- Article "fin de bail"
- Article "remise en état"

INDICES À RECHERCHER :
- "restitution des locaux", "remise des clés"
- "remise en état", "état d'origine", "configuration initiale"
- "devis de travaux", "bureau d'études"
- "très bon état", "bon état d'entretien"
- "libre de tout occupant et de tout mobilier"

Format de sortie JSON conforme à RestitutionData.`

export const TRANSFER_PROMPT = `Extraire les conditions de cession et sous-location.

CHAMPS À EXTRAIRE :

1. SOUS-LOCATION :
- sublettingConditions : Conditions de sous-location (description détaillée)
  FORMAT ATTENDU - Inclure :
  - Si autorisée ou interdite
  - Limites (% de la surface)
  - Bénéficiaires autorisés (sociétés affiliées, tiers)
  - Nécessité d'autorisation du bailleur
  
  EXEMPLES DE RÉPONSES :
  - "La sous-location partielle est autorisée avec accord du bailleur"
  - "Sous-location : 
    - au profit des Sociétés Affiliées du Preneur, dans la limite de 75% de la surface, sans autorisation du bailleur
    - au profit de tiers, dans la limite de 75% de la surface, soumise à autorisation du bailleur"
  - "Sous-location interdite"

2. CESSION :
- assignmentConditions : Conditions de cession du bail
  ⚠️ FORMAT ATTENDU : Phrase structurée et lisible
  - Structure : "[Étendue] et [autorisation] avec [clause de solidarité si applicable]"
  
  EXEMPLES DE BONNES RÉPONSES :
  - "Sur la totalité et soumise à autorisation du bailleur avec une clause de solidarité pendant 3 ans"
  - "Cession autorisée uniquement à l'acquéreur de la totalité du fonds de commerce"
  
  ❌ MAUVAISE RÉPONSE (trop détaillée, mal rédigée) :
  - "Le preneur ne pourra céder le bail que pour l'acquéreur..." (copie du texte)
  
  ÉLÉMENTS À EXTRAIRE ET SYNTHÉTISER :
  - Étendue : "totalité" ou "partielle" ?
  - Autorisation : "soumise à autorisation du bailleur" ?
  - Solidarité : "clause de solidarité pendant X ans" ?

3. DIVISION DES LOCAUX :
- divisionPossible : Possibilité de diviser les locaux
  FORMAT ATTENDU :
  - "Oui" / "Non" / "Non mentionné"
  - OU description détaillée si clause spécifique
  - Ex: "Les locaux sont déclarés indivisibles au seul bénéfice du Bailleur"
  
  INDICES : "indivisible", "divisible", "division", "indivisibilité"

OÙ CHERCHER :
- Article "cession" ou "sous-location"
- Article sur les droits du preneur
- Clauses diverses en fin de bail

INDICES À RECHERCHER :
- "sous-location", "sous-louer", "sous-locataire"
- "sociétés affiliées", "filiales"
- "cession", "céder le bail", "transmission"
- "agrément", "accord préalable", "autorisation"
- "garantie solidaire", "solidarité pendant X ans"
- "indivisibilité", "locaux indivisibles"

Format de sortie JSON conforme à TransferData.`

export const ENVIRONMENTAL_ANNEXES_PROMPT = `Extraire les annexes environnementales RÉELLEMENT ANNEXÉES au bail.

⚠️ RÈGLE FONDAMENTALE : Répondre "true" UNIQUEMENT si le document est EFFECTIVEMENT ANNEXÉ.
Ne pas confondre "le bailleur devra faire effectuer" (obligation future) avec "est annexé" (présent).

CHAMPS À EXTRAIRE :

1. DPE (Diagnostic de Performance Énergétique) :
- hasDPE : Le DPE est-il ANNEXÉ au bail ? (true/false)
  - TRUE si : "le DPE est annexé", "le bailleur annexe le DPE"
  - TRUE si : mentionné dans liste des annexes
  - FALSE si : non mentionné comme annexé
- dpeNote : Classe énergétique (A à G) si mentionnée
  - Attention OCR : A/4, B/8, G/6 peuvent être confondus

2. DIAGNOSTIC AMIANTE :
- hasAsbestosDiagnostic : Le diagnostic amiante est-il ANNEXÉ ? (true/false)
  ⚠️ ATTENTION À LA DISTINCTION :
  - TRUE si : "le diagnostic amiante est annexé", présent dans liste des annexes
  - FALSE si : "le bailleur DEVRA faire effectuer" ← C'est une OBLIGATION, pas une annexe !
  - FALSE si : "le bailleur devra tenir ces éléments à disposition" ← pas annexé
  - La phrase "Pour tout bâtiment... le bailleur devra faire effectuer..." signifie FALSE

3. ANNEXE ENVIRONNEMENTALE (bail vert) :
- hasEnvironmentalAnnex : L'annexe environnementale est-elle ANNEXÉE ? (true/false)
  - Obligatoire UNIQUEMENT pour surfaces > 2000 m²
  - Si locaux < 2000 m² : répondre "false" (pas concerné)
  - Si > 2000 m² et annexée : "true"

4. ÉTAT DES RISQUES ET POLLUTIONS :
- hasRiskAndPollutionStatement : L'ERP est-il ANNEXÉ ? (true/false)
  - TRUE si : "état des risques... est annexé aux présentes"
  - TRUE si : "Le preneur reconnaît en avoir pris connaissance"

EXEMPLES :
- "le bailleur annexe le diagnostic de performance énergétique" → hasDPE: true
- "Le preneur reconnaît en avoir pris connaissance" (après mention ERP) → hasRiskAndPollutionStatement: true
- "le bailleur DEVRA faire effectuer des diagnostics relatifs à la présence d'amiante" → hasAsbestosDiagnostic: false
- Surface des locaux = 218 m² → hasEnvironmentalAnnex: false (pas concerné car < 2000 m²)

Format de sortie JSON conforme à EnvironmentalAnnexesData.`

export const OTHER_ANNEXES_PROMPT = `Extraire les autres annexes RÉELLEMENT ANNEXÉES au bail.

⚠️ RÈGLE FONDAMENTALE : Répondre "true" UNIQUEMENT si le document est EFFECTIVEMENT ANNEXÉ au moment de la signature.
Ne pas confondre :
- "est annexé aux présentes" → TRUE (annexe présente)
- "sera adressé par le bailleur" → FALSE (document futur, pas annexé)
- "dont copie lui a été remise" → peut être TRUE si c'est une annexe

CHAMPS À EXTRAIRE :

- hasInternalRegulations : Règlement intérieur/copropriété ANNEXÉ ? (true/false)
  - TRUE si : "règlement annexé", "dont copie EST annexée"
  - FALSE si : "dont copie lui A ÉTÉ remise" avec (s'il en existe) ← conditionnel, pas annexé
  - FALSE si : simplement mentionné sans être annexé

- hasPremisesPlan : Plan des locaux ANNEXÉ ? (true/false)
  - TRUE si : listé dans les annexes, "plan annexé"
  - FALSE si : non mentionné comme annexé

- hasChargesInventory : Inventaire des charges ANNEXÉ ? (true/false)
  - TRUE si : "inventaire des catégories de charges... est annexé aux présentes"
  - Chercher dans article "CHARGES ET TAXES"

- hasAnnualChargesSummary : Récapitulatif annuel des charges ANNEXÉ ? (true/false)
  ⚠️ ATTENTION À LA DISTINCTION :
  - TRUE si : le récapitulatif EST annexé (rare)
  - FALSE si : "Un état récapitulatif SERA adressé" ← futur, donc pas annexé
  - FALSE si : "dans le délai de trois mois à compter de..." ← obligation future

- hasThreeYearWorksBudget : Budget prévisionnel travaux 3 ans ANNEXÉ ? (true/false)
  - TRUE si : explicitement annexé
  - FALSE si : non mentionné ou obligation future

- hasPastWorksSummary : Récapitulatif travaux passés ANNEXÉ ? (true/false)
  - TRUE si : explicitement annexé
  - FALSE si : non mentionné

EXEMPLES :
- "Un inventaire des catégories de charges... est annexé aux présentes"
  → hasChargesInventory: true
- "Un état récapitulatif annuel SERA adressé par le bailleur"
  → hasAnnualChargesSummary: false (futur, pas annexé)
- "règlement de copropriété, dont copie lui a été remise, (s'il en existe)"
  → hasInternalRegulations: false (conditionnel)

Format de sortie JSON conforme à OtherAnnexesData.`

export const OTHER_PROMPT = `Extraire les autres informations importantes.

CHAMPS À EXTRAIRE :

1. DÉROGATIONS AU CODE CIVIL (RECHERCHE ACTIVE OBLIGATOIRE) :
- civilCodeDerogations : Dérogations au Code civil (tableau de chaînes)
  
  ⚠️ RECHERCHE EXHAUSTIVE REQUISE - Tu DOIS parcourir TOUT le document pour trouver :
  - Toute mention de "dérogation", "dérogeant", "par dérogation à"
  - Les mots "article" suivis d'un numéro entre 1719 et 1762
  - Les formulations "renonce à tout recours", "sans indemnité ni recours"
  
  ARTICLES LES PLUS FRÉQUEMMENT DÉROGÉS (chercher ces numéros) :
  - Article 1721 : Garantie des vices et défauts → chercher "1721", "vices", "défauts de la chose louée"
  - Article 1723 : Changement de forme → chercher "1723", "modification", "transformation de l'immeuble"
  - Article 1724 : Réduction de loyer pour travaux → chercher "1724", "gêne des travaux", "sans indemnité"
  - Article 1719 : Obligations du bailleur
  - Article 1720 : Délivrance en bon état
  - Article 1722 : Destruction de la chose louée
  - Article 1755 : Présomption de responsabilité du preneur
  
  OÙ CHERCHER (TOUS CES ARTICLES) :
  - Article "ENTRETIEN", "RÉPARATIONS", "MISE EN CONFORMITÉ"
  - Article "TRAVAUX" (travaux du bailleur que le preneur doit souffrir)
  - Article "ASSURANCES" (responsabilité)
  - Tout paragraphe mentionnant "supporter sans indemnité"
  
  FORMAT DE SORTIE :
  - "Il est dérogé aux articles [X], [Y] et [Z] du Code civil"
  - OU liste détaillée : ["Dérogation article 1721 : ...", "Dérogation article 1723 : ..."]
  - Si VRAIMENT aucune dérogation après recherche exhaustive : "Aucune dérogation"

2. DÉROGATIONS AU CODE DE COMMERCE (RECHERCHE ACTIVE OBLIGATOIRE) :
- commercialCodeDerogations : Dérogations au Code de commerce (tableau de chaînes)
  
  RECHERCHE ACTIVE - Parcourir le document pour trouver :
  - Références aux articles L.145-XX du Code de commerce
  - Clauses relatives au plafonnement du loyer, renouvellement, éviction
  
  ARTICLES FRÉQUEMMENT DÉROGÉS :
  - L.145-6 : Durée minimale et renouvellement
  - L.145-34 : Plafonnement du loyer au renouvellement
  - L.145-33 : Fixation du loyer
  
  FORMAT DE SORTIE :
  - "Dérogation à l'article L. [X] du Code de commerce : [contexte]"
  - Si aucune dérogation explicite au Code de commerce : "Aucune dérogation"

EXEMPLES CONCRETS DE DÉROGATIONS À TROUVER :

Exemple 1 - Article 1721 (dans article ENTRETIEN) :
"le preneur renonçant par ailleurs expressément à tous recours à l'encontre du bailleur pour les vices et défauts de la chose louée, par dérogation à l'article 1721 du Code Civil"
→ civilCodeDerogations: ["Il est dérogé à l'article 1721 du Code civil"]

Exemple 2 - Article 1724 (dans article TRAVAUX) :
"Supporter sans indemnité ni recours contre le bailleur, par dérogation aux dispositions de l'article 1724 du Code Civil, la gêne et les conséquences..."
→ AJOUTER à civilCodeDerogations

Exemple 3 - Article 1723 (dans article TRAVAUX) :
"Supporter en outre, sans indemnité ni recours contre le bailleur par dérogation à l'article 1723 du code civil, toute modification qui pourrait être apportée à l'immeuble"
→ AJOUTER à civilCodeDerogations

RÉSULTAT ATTENDU POUR UN BAIL CLASSIQUE :
civilCodeDerogations: ["Il est dérogé aux articles 1721, 1723 et 1724 du Code civil"]

⚠️ ATTENTION : La plupart des baux commerciaux contiennent des dérogations au Code civil.
Ne retourne "Aucune dérogation" QUE si tu as cherché dans TOUT le document et n'as trouvé AUCUNE mention de ces articles.

Format de sortie JSON conforme à OtherData.`

export interface ExtractionPrompt {
  section: ExtractionSection
  prompt: string
  retryable: boolean
}

type PromptDefinition = {
  prompt: string
  retryable: boolean
}

const PROMPT_ORDER: ExtractionSection[] = [
  "regime",
  "parties",
  "premises",
  "calendar",
  "supportMeasures",
  "rent",
  "indexation",
  "taxes",
  "charges",
  "insurance",
  "securities",
  "inventory",
  "maintenance",
  "restitution",
  "transfer",
  "environmentalAnnexes",
  "otherAnnexes",
  "other",
]

export const PROMPT_DEFINITIONS: Record<ExtractionSection, PromptDefinition> = {
  regime: { prompt: REGIME_PROMPT, retryable: true },
  parties: { prompt: PARTIES_PROMPT, retryable: true },
  premises: { prompt: PREMISES_PROMPT, retryable: true },
  calendar: { prompt: CALENDAR_PROMPT, retryable: true },
  supportMeasures: { prompt: SUPPORT_MEASURES_PROMPT, retryable: true },
  rent: { prompt: RENT_PROMPT, retryable: true },
  indexation: { prompt: INDEXATION_PROMPT, retryable: true },
  taxes: { prompt: TAXES_PROMPT, retryable: true },
  charges: { prompt: CHARGES_PROMPT, retryable: true },
  insurance: { prompt: INSURANCE_PROMPT, retryable: true },
  securities: { prompt: SECURITIES_PROMPT, retryable: true },
  inventory: { prompt: INVENTORY_PROMPT, retryable: true },
  maintenance: { prompt: MAINTENANCE_PROMPT, retryable: true },
  restitution: { prompt: RESTITUTION_PROMPT, retryable: true },
  transfer: { prompt: TRANSFER_PROMPT, retryable: true },
  environmentalAnnexes: {
    prompt: ENVIRONMENTAL_ANNEXES_PROMPT,
    retryable: true,
  },
  otherAnnexes: { prompt: OTHER_ANNEXES_PROMPT, retryable: true },
  other: { prompt: OTHER_PROMPT, retryable: true },
}

export const EXTRACTION_PROMPTS: ExtractionPrompt[] = PROMPT_ORDER.map(
  (section) => ({
    section,
    prompt: PROMPT_DEFINITIONS[section].prompt,
    retryable: PROMPT_DEFINITIONS[section].retryable,
  })
)
