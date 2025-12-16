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
- Confusions courantes : O/0, I/1/l, S/5, B/8, symbole euro mal reconnu
- Espacements incorrects : séparateurs de milliers incohérents, espaces au milieu des unités ("m 2" au lieu de "m²")
- Mots coupés ou fusionnés : "bail commercial" vs "bailcommercial"
- Caractères spéciaux altérés : "€" → "EUR", "²" → "2", "°" → "o"
- Tableaux mal reconnus : colonnes mélangées, alignements cassés

ERREURS OCR SPÉCIFIQUES AUX SURFACES :
- "m?" = "m²" (le point d'interrogation remplace souvent le ²)
- "m'" = "m²" (l'apostrophe remplace souvent le ²)
- "m 2" ou "m2" = "m²"
- Dans certains OCR, un point peut être un séparateur de milliers (vérifier le contexte et l'ordre de grandeur)

ERREURS OCR SPÉCIFIQUES AUX EMAILS :
- "@" peut devenir "a", "©", "(a)", "[at]"
- Les points peuvent disparaître : "exemplecom" au lieu de "exemple.com"

Quand tu rencontres ces problèmes :
- Interprète avec bon sens les erreurs évidentes (ex: "lO OOO €" peut correspondre à un montant avec séparateurs mal reconnus)
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

BAUX AVEC CONDITIONS GÉNÉRALES ET CONDITIONS PARTICULIÈRES :
Certains baux sont structurés en deux parties distinctes :
- TITRE I / CONDITIONS GÉNÉRALES : clauses types, mécanismes généraux, règles par défaut
- TITRE II / CONDITIONS PARTICULIÈRES : valeurs concrètes, montants, dates, dérogations

⚠️⚠️⚠️ RÈGLE CRITIQUE DE PRIORITÉ ⚠️⚠️⚠️
Les CONDITIONS PARTICULIÈRES (Titre II) DÉROGENT TOUJOURS aux CONDITIONS GÉNÉRALES (Titre I).
- Si le Titre II modifie un article du Titre I, c'est la version du Titre II qui s'applique.
- Exemple : Si Titre I article 12 dit "trois mois" et Titre II article 10.8 dit "quatre mois", 
  la valeur correcte est "quatre mois" (Titre II prévaut).
- Formulation type : "Par dérogation à l'article X du Titre I..." ou "L'article X est modifié comme suit..."
- TOUJOURS chercher d'abord dans le Titre II avant de citer le Titre I.

Les mentions dans l'exposé préalable/préambule sont souvent HISTORIQUES (ancien bail résilié) - ne pas les utiliser comme valeurs actuelles.

FORMAT DES SOURCES - OBLIGATOIRE :
Pour le champ "source", TOUJOURS préciser si l'article provient du Titre I ou du Titre II :
- ✅ BON : "TITRE II - Article 10.8 (modifiant l'article 12 du Titre I)"
- ✅ BON : "TITRE I - Article 12"
- ✅ BON : "TITRE II - CONDITIONS PARTICULIÈRES 6. LOYER"
- ❌ MAUVAIS : "Article 12" (sans préciser Titre I ou II)
- ❌ MAUVAIS : "page 15" (trop vague si des articles sont identifiables)

FORMAT DE SORTIE :
Pour chaque champ extrait :
{
  "value": <valeur extraite ou null>,
  "confidence": "high" | "medium" | "low" | "missing",
  "source": "TITRE I/II - Article X" (TOUJOURS préciser le titre),
  "rawText": "extrait du texte original supportant la valeur" (optionnel mais recommandé)
}

EXEMPLES DE FORMAT DE SORTIE :

1. Information trouvée :
{
  "value": "Bail commercial",
  "confidence": "high",
  "source": "page <N>",
  "rawText": "BAIL COMMERCIAL entre les soussignés"
}

2. Information NON trouvée (VALEUR PAR DÉFAUT) :
{
  "value": null,
  "confidence": "missing",
  "source": "",
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
- "Bail dérogatoire d'une durée inférieure à trois ans (article L.145-5)..." → regime: "Bail dérogatoire"

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
- Le SIREN est un identifiant à neuf chiffres : XXX XXX XXX
- Le SIRET est un identifiant à quatorze chiffres : XXX XXX XXX XXXXX
- Chercher dans : "RCS", "SIRET", "SIREN", "immatriculée sous le numéro"
- Format possible : "XXX XXX XXX", "XXXXXXXXX", "RCS <Ville> XXX XXX XXX"
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
- "La <SOCIÉTÉ>, RCS <Ville> XXX XXX XXX, dont le représentant légal est <Nom>"
  → landlord.name: "<SOCIÉTÉ>", landlord.siren: "<SIREN_SANS_ESPACES>"
  → landlordRepresentative: null (le gérant n'est pas un mandataire externe)
- "La SCI IMMOBILIER, représentée par la société GESTION IMMO, administrateur de biens"
  → landlord.name: "SCI IMMOBILIER", landlordRepresentative.name: "GESTION IMMO"
- "Article <N> - Notifications : par email à <email> pour le Bailleur"
  → landlord.email: "<email>"
- Email non trouvé dans le document
  → landlord.email: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }
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
- designation : Nom de l'actif immobilier / désignation des locaux loués
  ⚠️ PRIORITÉ : Extraire le NOM DE L'ACTIF IMMOBILIER si mentionné (ex: "Immeuble Le Parc", "Centre Commercial Les Halles", "Bâtiment A", "Résidence Les Jardins")
  - Si le nom de l'actif n'est pas mentionné, utiliser la description des locaux
  - Format attendu : "[Nom de l'actif]" ou "[Type de local] et [éléments annexes]"
  - Exemples de noms d'actifs : "Immeuble Le Parc", "Centre Commercial Les Halles", "Bâtiment A", "Résidence Les Jardins"
  - Exemples de descriptions : "Local mixte activités/bureaux et <N> places de parking"
  - OÙ CHERCHER :
    * En-tête du document ou préambule : "bail portant sur l'immeuble X", "bâtiment Y", "centre commercial Z"
    * Article "DÉSIGNATION" ou "DÉFINITION DES LOCAUX" : chercher le nom propre de l'actif AVANT la description des locaux
    * Références dans le texte : "ledit immeuble", "le bâtiment", "le centre commercial" suivi d'un nom
  - ⚠️ NE PAS utiliser : le titre du document (ex: "Bail avec 1 avenant..."), le nom du bailleur/preneur, les références génériques sans nom propre
  - Si aucun nom d'actif n'est trouvé, utiliser la description des locaux comme fallback
  
- purpose (destination) : Usage autorisé des locaux
  - ⚠️ TOUJOURS commencer par "Usage exclusif de" ou "Usage de" si mentionné comme tel
  - Format attendu : "Usage exclusif d'[activité]" ou "Usage de [activité]. Exclusion : [activités interdites]"
  - Chercher dans article "DESTINATION"
  - Termes : "à usage exclusif de", "qu'à usage de", "destiné à"
  - Ex: "Usage exclusif d'activités/bureaux"
  - Ex: "Usage de bureaux. Exclusion : réception du public"
  
- address : Adresse des locaux (ville et code postal)
  - Format préféré : "[Ville] [Code postal]" ou adresse complète
  - Ex: "<Ville> <Code postal>" ou "<Numéro>, <Rue> <Code postal> <Ville>"

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
  - Dans certains OCR, un point peut être un séparateur de milliers (vérifier le contexte)
  
  EXEMPLES :
  - "surface totale de <SURFACE> m²" → surfaceArea: <SURFACE>
  - "Bureaux : <S1> m² et <S2> m², Activités : <S3> m² et <S4> m²" → surfaceArea: <S1+S2+S3+S4>
  - "0 m²" ou surface non trouvée → mentionner dans rawText les surfaces partielles trouvées

4. AMÉNAGEMENTS :
- isPartitioned : Locaux cloisonnés (présence de cloisons/séparations internes) ?
  - Valeur boolean : true si cloisonnés, false si open-space, null si non mentionné
  - Indices de cloisonnement à chercher :
    - "salles de réunion", "bureaux individuels", "plusieurs pièces"
    - "cloisons", "séparations", "compartimenté"
    - Descriptions dans CLAUSE SUSPENSIVE mentionnant "création de salles"
    - Travaux préalables de cloisonnement
  - Si des travaux de cloisonnement sont prévus → les locaux seront cloisonnés
  - Ex: création d'une salle de réunion dans la clause suspensive → true
  
- hasFurniture : Présence de mobilier FOURNI par le bailleur ?
  ⚠️ FORMAT : boolean (true/false) ou null
  - true : si mobilier fourni par le bailleur est explicitement mentionné
  - false : si explicitement mentionné qu'il n'y a PAS de mobilier fourni
  - null : si non mentionné (pas d'information dans le document)
  - ATTENTION : Ne pas confondre avec la clause de garnissement (obligation du preneur)
  - Si pas de mobilier fourni explicitement mentionné → null (pas false)
  
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
- hasOutdoorSpace : Espace extérieur (terrasse, cour, jardin) LOUÉ avec les locaux
  ⚠️ FORMAT : boolean (true/false) ou null
  - true : si un espace extérieur fait explicitement partie des locaux loués
  - false : si explicitement mentionné qu'il n'y a PAS d'espace extérieur loué
  - null : si non mentionné (pas d'information dans le document)
  ⚠️ ATTENTION : Ne pas confondre avec des mentions d'espaces dans :
  - Les travaux préalables/clause suspensive (aménagements avant entrée)
  - Les descriptions générales de l'immeuble
  - Les parties communes non louées
  - Les parkings extérieurs (ce sont des parkings, pas un espace extérieur loué)
  
- hasArchiveSpace : Local d'archives LOUÉ avec les locaux
  ⚠️ FORMAT : boolean (true/false) ou null
  - true : si un local d'archives fait explicitement partie des locaux loués
  - false : si explicitement mentionné qu'il n'y a PAS de local d'archives
  - null : si non mentionné (pas d'information dans le document)
  
- parkingSpaces : Nombre de places de parking voitures
  ⚠️ IMPORTANT : Si AUCUN parking n'est mentionné dans le bail, retourner 0 (zéro), PAS null
  - Si des parkings sont mentionnés avec un nombre → ce nombre
  - Si explicitement "sans parking", "aucun parking" → 0
  - Si le bail ne parle PAS du tout de parking → 0
- twoWheelerSpaces : Places deux-roues motorisés (0 si non mentionné)
- bikeSpaces : Places vélos (0 si non mentionné)

6. TANTIÈMES / QUOTE-PART :
- shareWithCommonAreas : Quote-part parties communes
  - Format : valeur ou "Non mentionné"
- shareWithoutCommonAreas : Quote-part hors parties communes
  - Format : valeur ou "Non mentionné"
- totalBuildingShare : Tantièmes sur l'ensemble de l'immeuble

EXEMPLES COMPLETS :
- "BAIL COMMERCIAL portant sur l'immeuble 'Le Parc', local mixte activités/bureaux d'une surface de 218 m²"
  → designation: "Immeuble Le Parc"
  → surfaceArea: 218, parkingSpaces: 4
- "Local mixte activités/bureaux d'une surface de 218 m² et 4 places de parking" (sans nom d'actif)
  → designation: "Local mixte activités/bureaux et 4 places de parking (n°1,2,3,4)"
  → surfaceArea: 218, parkingSpaces: 4
- "Centre Commercial Les Halles, local commercial au rez-de-chaussée"
  → designation: "Centre Commercial Les Halles"
- "À usage exclusif de bureaux, à l'exclusion de toute activité de réception du public"
  → purpose: "Usage exclusif de bureaux. Exclusion : activité de réception du public"
- Année de construction non mentionnée dans le document
  → buildingYear: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }
- Étages non mentionnés
  → floors: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }
- Clause d'enseigne absente
  → signageConditions: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }

Format de sortie JSON avec tous les champs ayant value, confidence, source.
IMPORTANT : 
- surfaceArea doit être un NOMBRE, pas une chaîne avec unité.
- Pour TOUS les champs manquants : value = null, rawText = "Non mentionné" (exactement cette formulation).`

export const CALENDAR_PROMPT = `Extraire toutes les dates et durées liées au bail.

CHAMPS À EXTRAIRE :

1. DATES CLÉS :
- signatureDate : Date de signature du bail (format ISO : YYYY-MM-DD)
  ⚠️ OÙ CHERCHER (OBLIGATOIRE - parcourir tout le document) :
  - EN FIN DE DOCUMENT : formule "Fait à [Ville], le [date]" ou "Signé le [date]"
  - APRÈS LES SIGNATURES : date manuscrite ou imprimée près des paraphes/signatures
  - PAGE DE SIGNATURE : souvent la dernière page avant les annexes
  - PROTOCOLE ou AVENANT : "signé le [date]", "en date du [date]"
  - PRÉAMBULE/EN-TÊTE : parfois mentionnée en haut du document
  ⚠️ NE PAS confondre avec la date d'effet (effectiveDate) qui est différente !
  - Si vraiment non trouvée après recherche exhaustive : "Non mentionné"
- effectiveDate : Date de prise d'effet / entrée en jouissance
- earlyAccessDate : Date de mise à disposition anticipée (si différente de effectiveDate)
- endDate : Date de fin du bail
  - IMPORTANT : la date de fin est la VEILLE de l'anniversaire, pas le jour même
  - Exemple (placeholder) : bail du JJ/MM/AAAA pour <DURÉE> ans → fin la veille de la date anniversaire (J-1)

2. DURÉE :
- duration : Durée du bail en années (nombre entier : 3, 6, 9, 10, 12...)
  - Format de sortie : "X ans" (ex: "9 ans", "10 ans")

3. ÉCHÉANCES :
- nextTriennialDate : Prochaine échéance triennale
  - IMPORTANT : l'échéance est la VEILLE de l'anniversaire triennal
  - Exemple (placeholder) : bail du JJ/MM/AAAA → première échéance triennale la veille du 3ème anniversaire (J-1)
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
- Bail commençant le JJ/MM/AAAA pour <DURÉE> ans : fin la veille de la date anniversaire (J-1)
- Bail commençant le JJ/MM/AAAA : 1ère échéance triennale la veille du 3ème anniversaire (J-1)

ATTENTION AUX FORMATS DE DATE :
- Formats français : "JJ mois AAAA", "JJ/MM/AAAA", "JJ mois AAAA" (sans "er")
- OCR peut altérer : "1er" → "1 er", "janvier" → "janvler"

EXEMPLES :
- "bail de <DURÉE> ans à compter du <DATE>"
  → duration: "<DURÉE> ans", effectiveDate: "<AAAA-MM-JJ>", endDate: "<AAAA-MM-JJ (J-1)>"
- "préavis de six mois avant l'échéance par lettre recommandée AR"
  → noticePeriod: "6 mois", terminationConditions: "Par lettre recommandée AR"
- "renouvellement pour 9 ans au loyer de marché"
  → renewalConditions: "Durée : 9 ans. Loyer : valeur locative de marché"
- Date de signature non trouvée dans le document
  → signatureDate: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }
- Conditions de renouvellement absentes
  → renewalConditions: { value: null, confidence: "missing", source: "", rawText: "Non mentionné" }

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
  
  ⚠️⚠️⚠️ DÉFINITION STRICTE - NE PAS CONFONDRE ⚠️⚠️⚠️
  Les mesures d'accompagnement sont des AVANTAGES INITIAUX accordés au preneur à la SIGNATURE du bail :
  ✅ CE QUI EST une mesure d'accompagnement :
  - Travaux d'aménagement réalisés par le bailleur AVANT ou AU MOMENT de l'entrée dans les lieux
  - Contribution financière du bailleur aux travaux d'aménagement du preneur
  - Prise en charge de frais de déménagement
  - Réduction temporaire de loyer (paliers progressifs)
  - Franchise de loyer (déjà traitée ci-dessus)
  
  ❌ CE QUI N'EST PAS une mesure d'accompagnement :
  - Les travaux à la charge du bailleur EN COURS DE BAIL (entretien, remplacement, mise aux normes)
  - Les obligations légales du bailleur (article 606 du Code civil)
  - La prise en charge de la vétusté des équipements (c'est de l'entretien courant)
  - Le remplacement des installations (chauffage, ascenseurs, etc.) → C'est la section "Travaux bailleur"
  
  ⚠️ FORMAT PRÉFÉRÉ : Résumer puis renvoyer à l'article du bail
  - Ex: "Contribution de 50 000 €HT aux travaux d'aménagement du preneur (cf. TITRE II - article 10.2)"
  - Ex: "Aménagements réalisés par le bailleur avant entrée (installation de stores, câblage). Cf. TITRE II - 8."
  - ❌ NE PAS inclure les travaux d'entretien ou de remplacement en cours de bail
  
INDICES À RECHERCHER :
- "franchise de loyer", "exemption de loyer", "gratuité de loyer"
- "mesures d'accompagnement", "avantages consentis"
- Article ou sous-article "mesures d'accompagnement" dans la section loyer
- "participation aux travaux d'aménagement", "contribution du bailleur"
- "paliers de loyer", "loyer progressif"
- "avant l'entrée dans les lieux", "préalablement à la prise d'effet"

OÙ CHERCHER :
- Article "Loyer" et ses sous-articles (section "franchise" ou "mesures d'accompagnement")
- Article dédié "Mesures d'accompagnement" ou "Avantages consentis"
- Article "Travaux" UNIQUEMENT pour les travaux d'aménagement initiaux (pas l'entretien en cours de bail)

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

⚠️ PRIORITÉ DE RECHERCHE - TRÈS IMPORTANT :
Pour les baux avec "Conditions Générales" et "Conditions Particulières" :
1. TOUJOURS PRIORISER les valeurs dans les CONDITIONS PARTICULIÈRES / TITRE II
2. Les mentions dans le "préambule" ou "exposé préalable" sont souvent HISTORIQUES (ancien bail)
3. Chercher "LOYER ANNUEL DE BASE" dans les conditions particulières
4. Ignorer les mentions comme "bail du [date antérieure] moyennant un loyer de X" qui sont l'historique

CHAMPS À EXTRAIRE :

1. LOYER PRINCIPAL (HORS TAXES, HORS CHARGES) :
- annualRentExclTaxExclCharges : Loyer annuel HTHC (en euros, sans symbole)
  ⚠️ ATTENTION AUX BAUX RENOUVELÉS :
  - Si le préambule mentionne un ancien loyer ET les conditions particulières un nouveau loyer
  - PRENDRE LE LOYER DES CONDITIONS PARTICULIÈRES (le loyer actuel)
  - L'ancien loyer est juste l'historique
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
- latePaymentPenaltyConditions : Description des conditions de pénalités
  ⚠️ FORMAT : Une seule phrase synthétique, SANS RÉPÉTITION
  - Inclure : taux/montant, délai avant application
  - NE PAS répéter la même information deux fois
  - Ex: "Taux d'intérêt légal majoré de 300 points de base, exigible 15 jours après mise en demeure"
  - ❌ MAUVAIS : "Taux légal majoré de 300 points. Taux légal majoré de 300 points exigible après..."
  - ✅ BON : "Taux d'intérêt légal majoré de 300 points de base, exigible 15 jours après mise en demeure restée sans effet"
  
- latePaymentPenaltyAmount : Montant ou taux des pénalités (valeur uniquement, sans la description)
  ⚠️⚠️⚠️ ATTENTION - NE PAS CONFONDRE POINTS DE BASE ET EUROS ⚠️⚠️⚠️
  - "300 points de base" = 300 POINTS (pas 300 €) → retourner "300 points de base" ou "3%"
  - "majoré de 300 points" = majoration de 3% → retourner "300 points de base" ou "3%"
  - "10% des sommes dues" = 10% → retourner "10%"
  - "indemnité de 500 €" = montant fixe → retourner "500 €"
  
  ⚠️ 1 point de base = 0,01% = 0,0001
  - 100 points de base = 1%
  - 300 points de base = 3%
  
  FORMAT DE RÉPONSE :
  - Pour un taux en points de base : "X points de base" ou "X%" (ex: "300 points de base" ou "3%")
  - Pour un montant fixe : "X €" (ex: "500 €")
  - ❌ NE JAMAIS mettre "300 €" quand le texte dit "300 points de base"

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
- "Loyer annuel : <MONTANT> € HT HC, payable trimestriellement d'avance"
  → annualRent: <MONTANT_NUMÉRIQUE>, quarterlyRent: <MONTANT_NUMÉRIQUE>, paymentFrequency: "Trimestriel d'avance"
- Loyer <MONTANT> € sans mention parking séparé avec <N> parkings
  → annualRent: <MONTANT_NUMÉRIQUE>, annualParkingRent: "Inclus dans le loyer initial des locaux"
- "À défaut de paiement, <TAUX> des sommes dues après <DÉLAI>"
  → latePaymentPenaltyConditions: "<TAUX> de toutes les sommes exigibles à l'expiration d'un délai de <DÉLAI>"

Format : valeurs numériques SANS symbole € ni séparateurs de milliers.`

export const INDEXATION_PROMPT = `Extraire les clauses d'indexation du loyer.

⚠️ PRIORITÉ DE RECHERCHE - TRÈS IMPORTANT :
Pour les baux avec "Conditions Générales" et "Conditions Particulières" :
1. Chercher d'abord dans les CONDITIONS PARTICULIÈRES / TITRE II
2. Section "INDICE DE REFERENCE" dans les conditions particulières
3. L'article "CLAUSE D'INDEXATION" dans les conditions générales décrit la méthode
4. Les CONDITIONS PARTICULIÈRES donnent l'indice concret et sa valeur

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
- referenceQuarter : Trimestre de référence AVEC la valeur de l'indice
  ⚠️ FORMAT OBLIGATOIRE : "[ACRONYME] T[1-4] [ANNÉE 2 CHIFFRES] ([VALEUR])"
  ⚠️ LA VALEUR ENTRE PARENTHÈSES EST CRITIQUE POUR LE CALCUL DES LOYERS
  
  COMMENT CONSTRUIRE LA VALEUR :
  - Acronyme : ILC, ILAT, ou ICC
  - Trimestre : T1, T2, T3, ou T4 (convertir "3ème trimestre" → T3)
  - Année : deux derniers chiffres (convertir "2015" → 15)
  - Valeur : CHERCHER ACTIVEMENT le nombre décimal associé à l'indice
  
  OÙ CHERCHER LA VALEUR DE L'INDICE :
  - CONDITIONS PARTICULIÈRES / TITRE II : "Indice de référence: ILAT 3T15 (107,98)"
  - "indice de base : 107,98", "valeur de l'indice : 104,60"
  - Souvent entre parenthèses juste après la mention du trimestre
  
  EXEMPLES DE CONVERSION :
  - "ILAT du 3ème trimestre 2015 soit 107,98" → "ILAT T3 15 (107,98)"
  - "indice ILC T4 2011 valeur 104,60" → "ILC T4 11 (104,60)"
  - Si AUCUNE valeur trouvée : "ILAT T3 15" (sans parenthèses)
  
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
  
- "ILAT référence au 3ème trimestre 2015 (107,98)"
  → referenceQuarter: "ILAT T3 15 (107,98)"
  
- "indice du 2ème trimestre 2016 (indice de base)" ou "ILAT 2T2016 valeur 104,60"
  → referenceQuarter: "ILAT T2 16 (104,60)"
  
- "ILC du 4ème trimestre 2011 à 104,60"
  → referenceQuarter: "ILC T4 11 (104,60)"
  
- "Indice de référence: ILAT 3T2015" (sans valeur mentionnée)
  → referenceQuarter: "ILAT T3 15"

Format de sortie JSON conforme à IndexationData.`

export const TAXES_PROMPT = `Extraire les informations sur les impôts et taxes.

⚠️ PRIORITÉ DE RECHERCHE - TRÈS IMPORTANT :
Pour les baux avec "Conditions Générales" et "Conditions Particulières" :
1. Chercher d'abord dans les CONDITIONS PARTICULIÈRES (peut être appelé TITRE II, CHAPITRE I, etc.)
2. Les articles numérotés (8.1, 8.2, 8.3, etc.) dans les conditions particulières contiennent souvent les montants précis
3. L'article "IMPOTS, CONTRIBUTIONS ET TAXES" ou "CHARGES ET TAXES" donne les détails
4. Chercher aussi dans la section "IV. LOYER" ou "IV. CHARGES" si présente

CHAMPS À EXTRAIRE :

1. REFACTURATION DES TAXES AU PRENEUR :
- propertyTaxRebilled : Refacturation de la taxe foncière et TEOM au preneur
  FORMAT DE RÉPONSE : Description textuelle de ce qui est refacturé
  - Ex: "Oui, taxe foncière et TEOM à la charge du preneur"
  - Ex: "Non mentionné" (si pas de clause)

2. PROVISIONS POUR TAXES (montants si mentionnés) :
- propertyTaxAmount : Provision annuelle pour taxe foncière (en euros, valeur numérique)
  ⚠️ Chercher dans TITRE II articles sur les taxes (ex: article 8.1)
  - Retourner null si pas de montant indiqué
  
- teomAmount : Provision annuelle pour TEOM (en euros, valeur numérique)
  ⚠️ TRÈS IMPORTANT - DÉFINITION :
  TEOM = Taxe d'Enlèvement des Ordures Ménagères
  Cette taxe peut être mentionnée sous différents noms dans les baux :
  - "TEOM" (acronyme)
  - "taxe d'enlèvement des ordures ménagères" (nom complet)
  - "ordures ménagères" (forme abrégée)
  - "enlèvement des ordures ménagères"
  
  ⚠️⚠️⚠️ CAS PARTICULIER - TEOM INCLUSE DANS LA TAXE FONCIÈRE ⚠️⚠️⚠️
  La TEOM est souvent INCLUSE dans le montant de la taxe foncière et non mentionnée séparément.
  - Si le bail mentionne "taxe foncière" SANS montant séparé pour la TEOM :
    → rawText = "TEOM incluse dans la taxe foncière (voir propertyTaxAmount)"
    → value = null (car pas de montant séparé)
    → confidence = "medium"
  - Si le bail mentionne un montant séparé pour la TEOM :
    → value = le montant mentionné
  
  INDICES À RECHERCHER :
  - Chercher les termes EXACTS ci-dessus dans TOUT le document
  - Chercher dans CONDITIONS PARTICULIÈRES articles numérotés (ex: article 8.2, IV.3, etc.)
  - Chercher dans sections "CHARGES", "TAXES", "IMPOTS"
  - Les montants peuvent être dans un tableau ou une liste de provisions
  - Format possible : "TEOM : provision annuelle de X €" ou "taxe d'enlèvement... : X €"
  - Si pas de montant séparé mais taxe foncière mentionnée : indiquer "incluse dans taxe foncière"
  
- officeTaxAmount : Provision annuelle pour taxe bureaux/TSB (en euros, valeur numérique)
  ⚠️ Aussi appelée : "taxe sur les bureaux", "TSB", "taxe annuelle sur les locaux à usage de bureaux"
  - Chercher dans CONDITIONS PARTICULIÈRES articles numérotés (ex: article 8.3, IV.3, etc.)
  - Chercher dans sections "CHARGES", "TAXES", "IMPOTS"
  - Format possible : "taxe sur les bureaux : provision annuelle de X €"
  - Retourner null si pas de montant indiqué

- parkingTaxAmount : Provision annuelle pour taxe sur les emplacements de parking (en euros, valeur numérique)
  ⚠️ Aussi appelée : "taxe parking", "taxe sur les emplacements de stationnement"
  - Chercher dans CONDITIONS PARTICULIÈRES articles numérotés
  - Chercher dans sections "CHARGES", "TAXES", "IMPOTS", "PARKING"
  - Retourner null si pas de montant indiqué ou si pas de taxe parking mentionnée

OÙ CHERCHER (PRIORITAIRE) :
1. CONDITIONS PARTICULIÈRES (TITRE II, CHAPITRE I, etc.) - articles numérotés (8.1, 8.2, 8.3, IV.3, etc.)
2. Section "IV. LOYER" ou "IV. CHARGES" dans les conditions particulières
3. Article "IMPOTS, CONTRIBUTIONS ET TAXES" ou "CHARGES ET TAXES"
4. Annexe "état récapitulatif des charges"
5. Parcourir TOUT le document pour trouver les mentions de TEOM et taxe bureaux

EXEMPLES CONCRETS :
- "Article 8.2 - TEOM : provision annuelle de 7 211,80 €"
  → teomAmount: { value: 7211.80, confidence: "high", source: "Article 8.2 du Titre II" }

- "Article 8.3 - Taxe bureaux : provision annuelle de 2 456,52 €"
  → officeTaxAmount: { value: 2456.52, confidence: "high", source: "Article 8.3 du Titre II" }

ATTENTION - MONTANTS PAR M² vs MONTANTS TOTAUX :
- Si le document donne "40 €/m²" : ceci est un montant PAR M²
- Les champs doivent contenir les montants TOTAUX annuels
- Si seul le montant par m² est donné : retourner null et mentionner le montant par m² dans rawText

Format de sortie JSON avec valeurs numériques (pas de symbole €).`

export const CHARGES_PROMPT = `Extraire les charges et honoraires de gestion.

⚠️ PRIORITÉ DE RECHERCHE - CHERCHER ACTIVEMENT :
1. CONDITIONS PARTICULIÈRES / TITRE II - Section "CHARGES" ou articles numérotés (8.x, 9.x)
2. TITRE I - Article "CHARGES LOCATIVES" ou "CHARGES ET TAXES"
3. Annexe "inventaire des charges" ou "état des charges"

CHAMPS À EXTRAIRE :

1. PROVISIONS POUR CHARGES :
- annualChargesProvisionExclTax : Provision TOTALE annuelle HT
  ⚠️ Chercher : "provision pour charges", "charges locatives"
- quarterlyChargesProvisionExclTax : Provision trimestrielle HT (si explicite)
- annualChargesProvisionPerSqmExclTax : Provision au m² HT (si explicite)
  - Chercher : "€/m²/an", "HT/m²", "par m² et par an"

2. REDEVANCE RIE :
- annualRIEFeeExclTax : Redevance annuelle HT
- quarterlyRIEFeeExclTax : Redevance trimestrielle HT (si explicite)
- annualRIEFeePerSqmExclTax : Redevance au m² HT (si explicite)

3. HONORAIRES DE GESTION LOCATIVE :
- managementFeesOnTenant : Honoraires de gestion LOCATIVE à charge du preneur (true/false)
  ⚠️ ATTENTION - DISTINCTION IMPORTANTE :
  - Il s'agit des honoraires de GESTION LOCATIVE du bailleur (property management)
  - CE N'EST PAS les charges communes ou les frais d'entretien courant
  
  → true UNIQUEMENT si : "honoraires de gestion locative à la charge du preneur", "frais de gérance refacturés"
  → false si : honoraires à la charge du bailleur, ou si les charges n'incluent PAS d'honoraires de gestion
  → null si : non mentionné explicitement
  
  ⚠️ ERREUR FRÉQUENTE : Ne pas confondre charges locatives (eau, électricité, entretien) avec honoraires de gestion locative
- rentManagementFeesOnTenant : Honoraires gestion des loyers à charge du preneur
- managementFeesAnnualAmount : Montant ANNUEL HT
- managementFeesQuarterlyAmount : Montant TRIMESTRIEL HT
- managementFeesPerSqmAmount : Montant au m² HT

ATTENTION - MONTANTS PAR M² vs MONTANTS TOTAUX :
- "30 €/m²/an" = montant PAR M², pas le total
- Mettre dans le champ approprié (PerSqm) et laisser le total à null

OÙ CHERCHER :
- CONDITIONS PARTICULIÈRES / TITRE II
- Article "CHARGES LOCATIVES", "CHARGES ET TAXES"
- Annexe "inventaire des charges"

Format de sortie JSON avec valeurs numériques.`

export const INSURANCE_PROMPT = `Extraire les informations d'assurance et recours.

CHAMPS À EXTRAIRE :

1. ASSURANCE MULTIRISQUE :
- annualInsuranceAmountExclTax : Prime annuelle HT (si mentionnée)
  - Extraire le montant numérique si explicitement indiqué
  - Si non mentionné : null

- insurancePremiumRebilled : Prime d'assurance IMMEUBLE refacturée au preneur (true/false)
  ⚠️ ATTENTION - DISTINCTION IMPORTANTE :
  - Il s'agit de l'assurance IMMEUBLE souscrite PAR LE BAILLEUR et REFACTURÉE au preneur
  - CE N'EST PAS l'assurance que le preneur doit souscrire pour ses propres risques
  
  → true UNIQUEMENT si : "assurance immeuble refacturée", "quote-part assurance immeuble à charge du preneur"
  → false si : seule l'obligation pour le preneur de souscrire SA PROPRE assurance est mentionnée
  → null si : non mentionné
  
  ⚠️ ERREUR FRÉQUENTE : Ne pas confondre "le preneur doit souscrire une assurance" (= sa propre assurance, pas refacturation) avec "l'assurance immeuble est refacturée"

2. CLAUSES SPÉCIFIQUES :
- hasWaiverOfRecourse : Renonciation RÉCIPROQUE à recours entre parties (true/false)
  ⚠️ ATTENTION - CLAUSE SPÉCIFIQUE :
  - Il s'agit d'une renonciation RÉCIPROQUE (les DEUX parties renoncent à recours l'une contre l'autre)
  - Phrase type EXACTE : "Les parties renoncent réciproquement à tout recours l'une contre l'autre"
  
  → true UNIQUEMENT si : clause de renonciation RÉCIPROQUE explicite
  → false si : une seule partie renonce (pas réciproque)
  → null si : non mentionné ou clause non trouvée
  
  ⚠️ Ne pas confondre avec d'autres clauses de responsabilité ou de recours non réciproques
  
- insuranceCertificateAnnexed : Attestation d'assurance EFFECTIVEMENT ANNEXÉE au bail (true/false)
  - true UNIQUEMENT si l'attestation est RÉELLEMENT ANNEXÉE (mentionnée dans liste des annexes)
  - false si l'attestation doit être FOURNIE ULTÉRIEUREMENT

OÙ CHERCHER :
- Article "ASSURANCES" ou "ASSURANCE ET RESPONSABILITÉ"
- Article "CHARGES LOCATIVES" (pour refacturation)
- Conditions particulières / TITRE II

EXEMPLES :
- "Les parties renoncent réciproquement à tout recours l'une contre l'autre et contre leurs assureurs"
  → hasWaiverOfRecourse: true
- "Une quote-part de l'assurance immeuble est refacturée au preneur"
  → insurancePremiumRebilled: true
- "Le preneur devra souscrire une assurance et fournir l'attestation annuellement"
  → insuranceCertificateAnnexed: false (obligation, pas annexé)

Format de sortie JSON conforme à InsuranceData.`

export const SECURITIES_PROMPT = `Extraire les sûretés et garanties.

⚠️ PRIORITÉ DE RECHERCHE - CHAMPS OBLIGATOIRES À TROUVER :
Le dépôt de garantie est TOUJOURS présent dans un bail commercial. Chercher ACTIVEMENT dans :
1. CONDITIONS PARTICULIÈRES / TITRE II - Section "DEPOT DE GARANTIE" ou "GARANTIE"
2. Article dédié "DÉPÔT DE GARANTIE" ou "SÛRETÉS"
3. Section "LOYER" (le dépôt est souvent mentionné avec le loyer)

CHAMPS À EXTRAIRE :

1. DÉPÔT DE GARANTIE :
- securityDepositDescription : Description COMPLÈTE du dépôt de garantie
  ⚠️ FORMAT : "[Nombre] mois de loyer hors taxes hors charges soit [montant] €"
  - Utiliser le format exact trouvé dans le document
  
- securityDepositAmount : Montant numérique du dépôt de garantie (en euros)
  ⚠️ CHERCHER ACTIVEMENT :
  - Termes : "dépôt de garantie", "garantie", "caution"
  - Souvent exprimé en "X mois de loyer" - CALCULER le montant réel basé sur le loyer du bail
  - Si dépôt = N mois et loyer mensuel = M €, alors montant = N × M
  - Retourner UNIQUEMENT le nombre calculé, sans symbole € ni séparateurs

2. AUTRES SÛRETÉS :
- otherSecurities : Liste des autres garanties (tableau de chaînes)
  - Cautionnement solidaire d'un tiers
  - Garantie bancaire à première demande (GAPD)
  - Nantissement de fonds de commerce
  - Si aucune sûreté additionnelle : retourner un tableau vide []

OÙ CHERCHER :
- CONDITIONS PARTICULIÈRES / TITRE II
- Article "DÉPÔT DE GARANTIE", "SÛRETÉS", "GARANTIES"
- Sections "LOYER" ou "CONDITIONS FINANCIÈRES"
- Annexes listant les garanties

EXEMPLES :
- "Le dépôt de garantie est fixé à <N> mois de loyer HT HC, soit <MONTANT> €"
  → securityDepositDescription: "<N> mois de loyer hors taxes hors charges soit <MONTANT> €"
  → securityDepositAmount: <MONTANT_NUMÉRIQUE>

- "Dépôt de garantie : un trimestre de loyer HTHC"
  → Si loyer trimestriel = <MONTANT> €
  → securityDepositDescription: "1 trimestre de loyer HTHC soit <MONTANT> €"
  → securityDepositAmount: <MONTANT_NUMÉRIQUE>

Format de sortie JSON avec securityDepositAmount en nombre et otherSecurities en tableau.`

export const INVENTORY_PROMPT = `Extraire les informations sur les états des lieux.

⚠️ CHERCHER ACTIVEMENT - Ces clauses sont TOUJOURS présentes dans un bail commercial :
1. CONDITIONS PARTICULIÈRES / TITRE II - Chercher "ÉTAT DES LIEUX"
2. TITRE I - Article "DÉLIVRANCE" ou "ÉTAT DES LIEUX"
3. Article "RESTITUTION" pour les conditions de sortie

CHAMPS À EXTRAIRE :

1. ÉTAT DES LIEUX D'ENTRÉE :
- entryInventoryConditions : Conditions de l'EDL d'entrée
  ⚠️ CHERCHER : "état des lieux d'entrée", "à l'entrée dans les lieux"
  - Mode : contradictoire, par huissier/commissaire de justice
  - Frais : partagés, à charge du preneur/bailleur
  - Si référence à un EDL antérieur, mentionner la date
  
2. ÉTAT DES LIEUX DE PRÉ-SORTIE :
- hasPreExitInventory : Existence d'une visite préalable (true/false/null)
  ⚠️ CHERCHER : "pré-état des lieux", "visite préalable", "X mois avant le terme"
  - Retourner true avec le délai si mentionné : "Oui, 4 mois avant le terme"
  - Retourner null si non mentionné
- preExitInventoryConditions : Conditions détaillées si applicable

3. ÉTAT DES LIEUX DE SORTIE :
- exitInventoryConditions : Conditions de l'EDL de sortie
  ⚠️ CHERCHER : "état des lieux de sortie", "à la sortie", "restitution"
  - Inclure les délais si mentionnés

OÙ CHERCHER (PRIORITÉ) :
1. TITRE II / CONDITIONS PARTICULIÈRES - sections modifiant le Titre I
2. Article "ÉTAT DES LIEUX" ou "DÉLIVRANCE DES LOCAUX"
3. Article "RESTITUTION DES LOCAUX"

INDICES À RECHERCHER :
- "état des lieux", "constat", "procès-verbal"
- "contradictoire", "amiable", "par huissier", "commissaire de justice"
- "pré-état des lieux", "visite préalable", "avant le terme"
- "frais partagés", "à la charge du"

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
  ⚠️ FORMAT ATTENDU : Liste des catégories de travaux bailleur
  - Inclure : "Travaux et grosses réparations définis à l'article 606 du Code civil"
  - Ajouter ravalement de façade si explicitement mentionné
  
  ⚠️⚠️⚠️ TITRE II - DÉROGATIONS IMPORTANTES ⚠️⚠️⚠️
  Le TITRE II (CONDITIONS PARTICULIÈRES) peut ÉTENDRE les travaux à la charge du bailleur.
  Chercher SPÉCIFIQUEMENT dans le Titre II les mentions :
  - "prise en charge par le bailleur du remplacement complet"
  - "mises en conformité et de la vétusté" à la charge du bailleur
  - Équipements concernés : chauffage, climatisation, ascenseurs, portes automatiques, GTB/GTC, huisseries, canalisations
  - Article type : 10.10, 10.11 du Titre II
  
  FORMAT ATTENDU avec Titre II :
  [
    "Travaux et grosses réparations définis à l'article 606 du Code civil (TITRE I)",
    "Ravalement de façade (TITRE I - Article 16.3)",
    "Prise en charge du remplacement complet, mises en conformité et vétusté des équipements (chauffage, climatisation, ascenseurs, portes automatiques, GTB/GTC, huisseries, canalisations) - cf. TITRE II - articles 10.10 et 10.11"
  ]
  
- tenantWorksList : Travaux à la charge du preneur (tableau structuré)
  ⚠️ FORMAT ATTENDU : 2-3 grandes catégories extraites du bail, pas une liste exhaustive
  - Ex:
    - "Effectuer toutes les réparations qui pourraient être nécessaires, y compris celle découlant de la vétusté et/ou de la force majeure"
    - "Effectuer à ses frais tous travaux prescrits par les autorités administratives"
    - "Travaux soumis à autorisation expresse et écrite du bailleur"
  - ❌ NE PAS copier tout l'article ni mélanger plusieurs articles

3. CLAUSE D'ACCESSION (CRITIQUE - FORMAT STRICT) :
- hasAccessionClause : Présence d'une clause d'accession (boolean : true/false)
  
  ⚠️ RETOURNER UN BOOLEAN, PAS UNE CHAÎNE DE CARACTÈRES !
  - Si clause trouvée : value = true
  - Si pas de clause trouvée : value = false (pas null, pas "Non mentionné")
  
  ⚠️ DÉFINITION STRICTE : La clause d'accession concerne UNIQUEMENT le TRANSFERT DE PROPRIÉTÉ
  des travaux réalisés par le preneur au bailleur en fin de bail.
  
  ⚠️ CE QUI N'EST PAS UNE CLAUSE D'ACCESSION (NE PAS CONFONDRE) :
  - L'obligation de demander une autorisation pour faire des travaux → false
  - Les conditions d'exécution des travaux (architecte, assurances) → false
  - La possibilité pour le bailleur d'exiger la remise en état → false (c'est l'inverse)
  
  INDICES À RECHERCHER (mots-clés EXACTS pour true) :
  - "deviendront la propriété du bailleur" ← true
  - "acquerront au bailleur" ← true
  - "resteront acquis au bailleur" ← true
  - "sans indemnité à la fin du bail" ← true
  
  OÙ CHERCHER : Article "TRAVAUX" section "Travaux du preneur", souvent alinéa d)
  
  FORMAT DE SORTIE :
  {
    "hasAccessionClause": {
      "value": true,
      "confidence": "high",
      "source": "Article 7 - Travaux du preneur",
      "rawText": "les travaux réalisés par le preneur deviendront la propriété du bailleur"
    }
  }
  OU si absent :
  {
    "hasAccessionClause": {
      "value": false,
      "confidence": "medium",
      "source": "",
      "rawText": "Non mentionné"
    }
  }

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

⚠️⚠️⚠️ RÈGLE CRITIQUE - PRIORITÉ TITRE II ⚠️⚠️⚠️
Le TITRE II (CONDITIONS PARTICULIÈRES) DÉROGE au TITRE I (CONDITIONS GÉNÉRALES).
- Si le Titre I dit "parfait état" et le Titre II dit "bon état" → retenir "bon état"
- Si le Titre I dit "trois mois" et le Titre II dit "quatre mois" → retenir "quatre mois"
- TOUJOURS chercher d'abord dans le Titre II les modifications/dérogations aux articles du Titre I

CHAMPS À EXTRAIRE :

1. RESTITUTION :
- restitutionConditions : Conditions générales de restitution
  ⚠️ ATTENTION - VÉRIFIER LE TITRE II :
  - Chercher d'abord dans le Titre II si l'article de restitution est modifié
  - Le Titre I peut mentionner "parfait état" mais le Titre II peut le modifier en "bon état"
  - Préciser la SOURCE (Titre I ou Titre II) dans la réponse
  
  FORMAT ATTENDU :
  - "Restituer les locaux en bon état d'entretien (TITRE II - article 10.8 modifiant TITRE I - article 12)"
  - NE PAS mentionner les conditions du Titre I si elles sont modifiées par le Titre II

2. REMISE EN ÉTAT :
- restorationConditions : Processus de remise en état
  ⚠️ ATTENTION - VÉRIFIER LE TITRE II :
  - Le délai de visite préalable peut être différent entre Titre I et Titre II
  - Si Titre I dit "trois mois" et Titre II dit "quatre mois" → retenir "quatre mois"
  - Préciser la SOURCE exacte (Titre II si modifié)
  
  FORMAT ATTENDU - décrire le processus avec les valeurs du Titre II :
  - Délai de la visite préalable (tel que modifié par le Titre II si applicable)
  - Qui établit les devis
  - Délai pour acquitter les travaux
  - PRÉCISER : "(TITRE II - article X modifiant l'article Y du Titre I)"
  
  EXEMPLES :
  - "Visite préalable quatre mois avant la fin du bail (TITRE II - article 10.8). Le bailleur notifiera les travaux à effectuer."
  - "Délai de 15 jours ouvrés pour acquitter le coût des travaux (TITRE II - article 10.8)"

OÙ CHERCHER (ORDRE DE PRIORITÉ) :
1. TITRE II - Articles modifiant les articles de restitution (ex: article 10.8)
2. TITRE I - Article "restitution des locaux" (seulement si pas modifié par Titre II)
3. Article "fin de bail", "remise en état"

INDICES À RECHERCHER :
- "restitution des locaux", "remise des clés"
- "remise en état", "état d'origine", "configuration initiale"
- "par dérogation à l'article X du Titre I" → UTILISER la version du Titre II
- "l'article X est modifié comme suit" → UTILISER la version du Titre II
- "bon état" vs "parfait état" → vérifier quelle version s'applique

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
  ⚠️ FORMAT ATTENDU : Phrase structurée COURTE et synthétique
  - Structure : "[Étendue], [autorisation], [solidarité]"
  - NE PAS répéter les mêmes informations
  - NE PAS inclure de détails superflus
  
  EXEMPLES DE BONNES RÉPONSES :
  - "Totalité, soumise à agrément du bailleur, clause de solidarité 3 ans"
  - "Acquéreur du fonds de commerce uniquement, avec agrément préalable"
  
  ❌ MAUVAISES RÉPONSES :
  - Trop longue avec répétitions : "...soumise à agrément/conditions prévues; le cédant demeure garant solidaire pendant trois (3) ans... (clause de solidarité pendant 3 ans)."
  - Copie du texte brut sans synthèse
  
  ÉLÉMENTS À SYNTHÉTISER (chacun UNE SEULE FOIS) :
  - Étendue : "totalité" ou "partielle"
  - Autorisation : "soumise à agrément" ou "libre"
  - Solidarité : durée en années si applicable

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
