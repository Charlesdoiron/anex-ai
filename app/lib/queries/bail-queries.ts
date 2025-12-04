// export interface BailQuery {
//   id: string;
//   query: string;
//   expectedFormat: string;
//   requiredFields?: string[];
//   context?: string;
// }

// export const bailQueries: BailQuery[] = [
//   // ============================================
//   // 1. RÉGIME JURIDIQUE ET NATURE DU BAIL
//   // ============================================
//   {
//     id: "regime_juridique",
//     query: `Identifier le régime juridique du bail en analysant l'ensemble du document :
//     - Régime principal : commercial (statut des baux commerciaux art. L145-1 et suivants du Code de commerce), civil, professionnel, précaire, dérogatoire (bail 3-6-9 dérogatoire), à construire (article L251-1 du CCH), à construction, bail emphytéotique (BEFA), mixte
//     - Références légales mentionnées dans le bail (articles de loi, décrets)
//     - Durée du bail qui peut indiquer le régime (ex: 9 ans = commercial classique, <2 ans = précaire, etc.)
//     - Nature de l'activité autorisée qui peut déterminer le régime
//     - Mentions explicites du type "Le présent bail est soumis au régime..."
//     - Clauses dérogatoires ou spécifiques mentionnées
//     - Si le bail mentionne plusieurs régimes ou une transition entre régimes, préciser
//     Citer la ou les clauses exactes permettant de déterminer le régime juridique.`,
//     expectedFormat: "structured",
//     context:
//       "Crucial pour déterminer les droits et obligations, le renouvellement, les conditions de résiliation",
//   },

//   // ============================================
//   // 2. PARTIES PRENANTES - BAILLEUR
//   // ============================================
//   {
//     id: "bailleur_identite",
//     query: `Extraire l'identité complète du bailleur (propriétaire/loueur) :
//     PERSONNE MORALE :
//     - Dénomination sociale complète
//     - Forme juridique (SAS, SARL, SA, SCI, SCPI, Association, etc.)
//     - Capital social (montant et devise)
//     - Numéro SIRET (14 chiffres) et SIREN (9 chiffres)
//     - Numéro RCS avec ville d'immatriculation
//     - Numéro de TVA intracommunautaire si mentionné
//     - Siège social complet (numéro, voie, complément, code postal, ville, pays)

//     PERSONNE PHYSIQUE :
//     - Nom et prénom(s) complets
//     - Date de naissance et lieu de naissance si mentionnés
//     - Domicile complet
//     - Profession si mentionnée
//     - État civil (célibataire, marié sous quel régime, divorcé, etc.)

//     COORDONNÉES :
//     - Adresse(s) email
//     - Numéro(s) de téléphone (fixe et mobile)
//     - Numéro de fax si mentionné
//     - Adresse de correspondance si différente du siège/domicile

//     REPRÉSENTATION :
//     - Nom et qualité du représentant légal (Président, Gérant, Directeur Général, etc.)
//     - Pouvoirs du représentant
//     - Documents justifiant des pouvoirs (extrait Kbis, délégation, etc.)

//     CO-BAILLEURS :
//     - Si plusieurs bailleurs, lister tous avec les mêmes informations
//     - Préciser la répartition de propriété (quote-part, indivision, etc.)`,
//     expectedFormat: "structured_json",
//     requiredFields: [
//       "denomination",
//       "forme_juridique",
//       "siret",
//       "adresse_siege",
//     ],
//   },

//   {
//     id: "mandataire_bailleur",
//     query: `Si le bailleur est représenté par un mandataire ou un gestionnaire :
//     - Type de représentation : mandataire, gestionnaire immobilier, administrateur de biens, syndic, avocat
//     - Raison sociale du mandataire
//     - SIRET du mandataire
//     - Adresse complète du mandataire
//     - Coordonnées (email, téléphone)
//     - Nom et qualité de la personne physique représentant le mandataire
//     - Nature du mandat : ad hoc, gestion locative complète, mandat de représentation
//     - Étendue des pouvoirs du mandataire (signature, encaissement loyers, travaux, etc.)
//     - Référence au mandat ou à la procuration
//     - Date et durée du mandat si mentionnées
//     Indiquer "Non applicable - Bailleur agit directement" si aucun mandataire n'est mentionné.`,
//     expectedFormat: "structured_json",
//   },

//   // ============================================
//   // 3. PARTIES PRENANTES - PRENEUR
//   // ============================================
//   {
//     id: "preneur_identite",
//     query: `Extraire l'identité complète du preneur (locataire/exploitant) :
//     PERSONNE MORALE :
//     - Dénomination sociale complète et nom commercial si différent
//     - Forme juridique (SAS, SARL, SA, EURL, Association, etc.)
//     - Capital social (montant et devise)
//     - Numéro SIRET (14 chiffres) et SIREN (9 chiffres)
//     - Numéro RCS avec ville d'immatriculation
//     - Code NAF/APE et secteur d'activité
//     - Numéro de TVA intracommunautaire si mentionné
//     - Siège social complet (numéro, voie, complément, code postal, ville, pays)

//     PERSONNE PHYSIQUE (entrepreneur individuel, profession libérale) :
//     - Nom et prénom(s) complets
//     - Date de naissance et lieu de naissance si mentionnés
//     - Domicile complet
//     - Numéro SIRET si entrepreneur
//     - Profession ou activité exercée
//     - État civil

//     REPRÉSENTATION LÉGALE :
//     - Nom et prénom(s) du représentant légal
//     - Qualité/fonction (Président, Gérant, Directeur Général, etc.)
//     - Pouvoirs du représentant

//     COORDONNÉES PROFESSIONNELLES :
//     - Adresse(s) email (générale et du représentant)
//     - Numéro(s) de téléphone professionnel(s)
//     - Site web si mentionné
//     - Adresse de correspondance si différente du siège

//     CO-PRENEURS OU SOUS-LOCATAIRES :
//     - Si plusieurs preneurs solidaires, lister tous avec les mêmes informations
//     - Si sous-location autorisée, préciser les conditions`,
//     expectedFormat: "structured_json",
//     requiredFields: [
//       "denomination",
//       "siret",
//       "representant_legal",
//       "adresse_siege",
//     ],
//   },

//   // ============================================
//   // 4. CARACTÉRISTIQUES IMMOBILIÈRES
//   // ============================================
//   //   {
//   //     id: "adresse_locaux",
//   //     query: `Extraire l'adresse postale complète et précise des locaux loués :
//   //     - Numéro dans la voie (avec bis, ter, quater si applicable)
//   //     - Type de voie (rue, avenue, boulevard, place, impasse, etc.)
//   //     - Nom de la voie
//   //     - Complément d'adresse (bâtiment, résidence, aile, escalier, etc.)
//   //     - Code postal (5 chiffres)
//   //     - Ville/Commune
//   //     - Arrondissement si applicable (Paris, Lyon, Marseille)
//   //     - Pays si précisé
//   //     - Coordonnées GPS si mentionnées
//   //     - Références cadastrales si mentionnées (section, numéro de parcelle)
//   //     - Tout élément permettant de localiser précisément les locaux`,
//   //     expectedFormat: "structured_address",
//   //     requiredFields: ["numero", "voie", "code_postal", "ville"],
//   //   },

//   //   {
//   //     id: "designation_cadastrale",
//   //     query: `Extraire toutes les références cadastrales et administratives :
//   //     - Section cadastrale
//   //     - Numéro(s) de parcelle(s)
//   //     - Lieu-dit si applicable
//   //     - Superficie cadastrale si mentionnée
//   //     - Références au plan cadastral
//   //     - Numéro de voirie
//   //     - Zone du PLU/POS (zone urbaine, commerciale, etc.)
//   //     - Servitudes éventuelles mentionnées
//   //     Indiquer "Non mentionné" si aucune référence cadastrale n'apparaît.`,
//   //     expectedFormat: "structured",
//   //   },

//   //   {
//   //     id: "designation_locaux",
//   //     query: `Extraire la désignation détaillée et exhaustive des locaux donnés à bail :

//   //     COMPOSITION PRINCIPALE :
//   //     - Nature générale (bureaux, local commercial, entrepôt, hangar, atelier, etc.)
//   //     - Description de chaque pièce/espace avec sa fonction : bureaux, salles de réunion, open space, accueil, archives, sanitaires, cuisine, vestiaires, etc.
//   //     - Nombre de pièces principales
//   //     - Configuration (plateau, cloisonné, modulable, etc.)

//   //     DÉPENDANCES ET ANNEXES :
//   //     - Places de parking (nombre, couvertes/découvertes, numéros)
//   //     - Caves ou sous-sols (nombre, numéros de lot)
//   //     - Locaux techniques (chaufferie, local poubelles, etc.)
//   //     - Espaces de stockage ou archives
//   //     - Terrasses, balcons (surface si mentionnée)
//   //     - Cours, jardins privatifs (surface si mentionnée)
//   //     - Box, garages (numéros)

//   //     ÉQUIPEMENTS IMMOBILIERS INCLUS :
//   //     - Système de chauffage (type : individuel/collectif, gaz/électrique/fioul)
//   //     - Climatisation (type, zones couvertes)
//   //     - Installations électriques spécifiques (puissance, tableau électrique)
//   //     - Plomberie et sanitaires (nombre de WC, point d'eau)
//   //     - Système de ventilation (VMC, extraction, etc.)
//   //     - Ascenseurs (nombre, charge, desserte)
//   //     - Installations de sécurité (alarme, vidéosurveillance, contrôle d'accès)
//   //     - Câblage informatique et télécom
//   //     - Interphone, vidéophone, digicode

//   //     ACCÈS ET CIRCULATION :
//   //     - Type d'accès (rue, cour, couloir commun, accès privatif)
//   //     - Parties communes nécessaires à l'accès
//   //     - Restrictions d'accès (horaires, conditions)

//   //     DROITS ET JOUISSANCE :
//   //     - Droits réels attachés aux locaux
//   //     - Servitudes actives ou passives
//   //     - Jouissance exclusive de certains espaces
//   //     - Droits sur les parties communes

//   //     Citer textuellement les passages du bail décrivant les locaux.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "destination_activite",
//   //     query: `Extraire toutes les informations relatives à la destination et l'usage autorisé des locaux :

//   //     DESTINATION CONTRACTUELLE :
//   //     - Destination principale autorisée (commerce de détail, bureaux, profession libérale, entrepôt, etc.)
//   //     - Activités spécifiquement autorisées ou interdites
//   //     - Restrictions ou limitations d'usage
//   //     - Clause de destination (activité précise ou activités connexes autorisées)

//   //     NATURE DE L'ACTIVITÉ COMMERCIALE :
//   //     - Secteur d'activité précis (restauration, habillement, services, etc.)
//   //     - Type de commerce (sédentaire, ambulant, artisanal, etc.)
//   //     - Niveau de nuisance autorisé (classement ICPE si applicable)

//   //     RESTRICTIONS ET INTERDICTIONS :
//   //     - Activités expressément interdites
//   //     - Nuisances interdites (sonores, olfactives, vibrations)
//   //     - Restrictions d'horaires d'exploitation
//   //     - Interdiction de certains types de clientèle
//   //     - Produits ou services interdits

//   //     CLAUSES SPÉCIFIQUES :
//   //     - Obligation de changement d'activité
//   //     - Clause d'exclusivité (pour le preneur ou interdiction de concurrence)
//   //     - Obligation d'exploitation effective et continue
//   //     - Conditions de déspécialisation (plénière ou partielle)
//   //     - Autorisations administratives nécessaires mentionnées (licence IV, agrément, etc.)

//   //     CONFORMITÉ RÉGLEMENTAIRE :
//   //     - Conformité aux règlements de copropriété
//   //     - Conformité au PLU/POS
//   //     - Normes ERP (Établissement Recevant du Public) si applicable
//   //     - Accessibilité PMR (Personnes à Mobilité Réduite)

//   //     Citer les clauses exactes du bail relatives à la destination.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "immeuble_caracteristiques",
//   //     query: `Extraire toutes les caractéristiques de l'immeuble dans lequel se situent les locaux :

//   //     CONSTRUCTION :
//   //     - Année de construction de l'immeuble
//   //     - Année de dernière rénovation importante si mentionnée
//   //     - Type de construction (immeuble haussmannien, moderne, récent, etc.)
//   //     - Nombre total d'étages de l'immeuble
//   //     - Présence d'ascenseur(s) (nombre, capacité)
//   //     - Matériaux de construction si mentionnés

//   //     STANDING ET CLASSIFICATION :
//   //     - Standing de l'immeuble (prestige, standard, etc.)
//   //     - Certification ou label (HQE, BBC, BREEAM, etc.)
//   //     - Classement monument historique ou protection architecturale

//   //     STATUT JURIDIQUE :
//   //     - Copropriété (préciser si horizontale, verticale)
//   //     - Monopropriété
//   //     - Division en volumes si applicable

//   //     ÉQUIPEMENTS COLLECTIFS :
//   //     - Gardien/concierge
//   //     - Espaces communs (hall, couloirs, etc.)
//   //     - Locaux vélos, poussettes
//   //     - Vide-ordures, local poubelles
//   //     - Chauffage collectif (type, énergie)

//   //     Indiquer "Information non mentionnée" pour chaque élément absent du bail.`,
//   //     expectedFormat: "structured",
//   //   },

//   //   {
//   //     id: "localisation_etages",
//   //     query: `Identifier précisément la localisation des locaux dans l'immeuble :
//   //     - Étage(s) exact(s) : sous-sol, rez-de-chaussée, entresol, étages (1er, 2e, etc.), dernier étage, combles
//   //     - Pour chaque niveau, préciser les locaux/pièces qui s'y trouvent
//   //     - Position dans l'immeuble (sur rue, sur cour, côté jardin, aile droite/gauche, etc.)
//   //     - Orientation (nord, sud, est, ouest) si mentionnée
//   //     - Luminosité ou vue si mentionnées
//   //     - Numéro de porte ou d'appartement
//   //     - Numéro de lot de copropriété pour chaque niveau
//   //     - Accès (escalier A/B/C, ascenseur, etc.)

//   //     Si les locaux s'étendent sur plusieurs niveaux, détailler chaque niveau.`,
//   //     expectedFormat: "structured_list",
//   //   },

//   //   {
//   //     id: "copropriete_lots",
//   //     query: `Extraire toutes les informations relatives à la copropriété :

//   //     NUMÉROS DE LOTS :
//   //     - Liste exhaustive de tous les numéros de lots concernés par le bail
//   //     - Pour chaque lot : préciser la nature (principal, annexe, cave, parking, etc.)
//   //     - Quote-part des parties communes pour chaque lot si mentionnée
//   //     - Tantièmes de copropriété (nombre et dénominateur)

//   //     RÈGLEMENT DE COPROPRIÉTÉ :
//   //     - Date du règlement de copropriété
//   //     - Modifications ultérieures au règlement
//   //     - Clauses du règlement opposables au preneur
//   //     - Restrictions d'usage imposées par le règlement

//   //     CHARGES DE COPROPRIÉTÉ :
//   //     - Répartition des charges entre bailleur et preneur
//   //     - Budget prévisionnel si mentionné
//   //     - Travaux votés ou à venir mentionnés

//   //     SYNDIC :
//   //     - Nom et coordonnées du syndic de copropriété
//   //     - Coordonnées du conseil syndical si mentionnées

//   //     Indiquer "Non applicable - Immeuble en monopropriété" si les locaux ne sont pas en copropriété.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   // ============================================
//   //   // 5. SURFACES ET MESURES
//   //   // ============================================
//   //   {
//   //     id: "surfaces_detaillees",
//   //     query: `Extraire TOUTES les surfaces mentionnées dans le bail avec une précision maximale :

//   //     SURFACE TOTALE :
//   //     - Surface totale des locaux loués (en m²)
//   //     - Méthode de mesure utilisée (Loi Carrez, Loi Boutin, surface utile, SHON, SHOB, surface habitable, surface de plancher, etc.)
//   //     - Date de mesurage si mentionnée
//   //     - Nom du géomètre ou diagnostiqueur si mentionné

//   //     SURFACES DÉTAILLÉES PAR LOCAL/PIÈCE :
//   //     Pour CHAQUE pièce, local ou espace mentionné, extraire :
//   //     - Nom/désignation de la pièce (bureau 1, salle de réunion, entrepôt, etc.)
//   //     - Surface en m² (avec décimales si précisées)
//   //     - Hauteur sous plafond si mentionnée
//   //     - Volume si mentionné (en m³)

//   //     SURFACES ANNEXES :
//   //     - Surface de chaque parking/box (en m²)
//   //     - Surface de chaque cave/cellier (en m²)
//   //     - Surface des terrasses/balcons (en m²)
//   //     - Surface des jardins privatifs (en m²)
//   //     - Surface des locaux techniques (en m²)

//   //     CALCULS ET VÉRIFICATIONS :
//   //     - Calculer la somme de toutes les surfaces partielles mentionnées
//   //     - Vérifier la cohérence avec la surface totale annoncée
//   //     - Signaler toute incohérence ou différence
//   //     - Convertir les surfaces si exprimées dans une autre unité (pieds carrés, hectares, ares, etc.)

//   //     SURFACES EXCLUSIONS :
//   //     - Éléments non comptabilisés dans la surface (parties communes, balcons, terrasses, caves selon la loi applicable)
//   //     - Surfaces de dégagements, circulations non privatifs

//   //     TOLÉRANCES :
//   //     - Marge de tolérance acceptée (généralement 5% en Loi Carrez)
//   //     - Conditions de révision du prix si différence de surface

//   //     DIAGNOSTICS ASSOCIÉS :
//   //     - Référence au DPE (Diagnostic de Performance Énergétique) avec la surface indiquée
//   //     - Autres diagnostics mentionnant une surface

//   //     Présenter les résultats sous forme de tableau structuré et calculer le total.`,
//   //     expectedFormat: "structured_table_with_calculation",
//   //     requiredFields: ["surface_totale", "unite", "methode_mesure"],
//   //   },

//   //   {
//   //     id: "configuration_cloisonnement",
//   //     query: `Analyser la configuration et le cloisonnement des locaux :

//   //     CLOISONNEMENT EXISTANT :
//   //     - Les locaux sont-ils cloisonnés ? (Réponse : Oui/Non/Partiellement)
//   //     - Si oui, type de cloisonnement : fixe, amovible, vitré, plein
//   //     - Nombre total de pièces/espaces cloisonnés
//   //     - Liste détaillée de chaque espace cloisonné avec :
//   //       * Nom ou fonction de l'espace
//   //       * Surface individuelle (en m²)
//   //       * Type de cloisons (maçonnerie, placo, vitrées, modulables)
//   //       * Hauteur des cloisons (jusqu'au plafond ou mi-hauteur)

//   //     CONFIGURATION :
//   //     - Plateau ouvert (open space) : surface en m² si applicable
//   //     - Bureaux individuels : nombre et surface de chacun
//   //     - Salles de réunion : nombre et capacité
//   //     - Espaces de circulation : couloirs, dégagements
//   //     - Zones techniques : surface et localisation

//   //     MODULARITÉ :
//   //     - Possibilité de modifier le cloisonnement (autorisé/interdit/sous conditions)
//   //     - Cloisons amovibles existantes
//   //     - Systèmes modulaires (rails, panneaux, etc.)

//   //     TRAVAUX DE CLOISONNEMENT :
//   //     - Travaux de cloisonnement autorisés par le bail
//   //     - Conditions d'autorisation préalable du bailleur
//   //     - Obligations de remise en état en fin de bail concernant les cloisons

//   //     PLANS :
//   //     - Référence à des plans annexés montrant le cloisonnement
//   //     - Plans modifiables ou non

//   //     Si aucune information sur le cloisonnement n'est mentionnée, indiquer "Non précisé dans le bail".`,
//   //     expectedFormat: "structured_with_boolean",
//   //   },

//   //   // ============================================
//   //   // 6. ÉQUIPEMENTS ET AMÉNAGEMENTS
//   //   // ============================================
//   //   {
//   //     id: "equipements_mobilier",
//   //     query: `Inventorier exhaustivement tous les équipements, mobiliers et installations fournis avec les locaux :

//   //     MOBILIER FOURNI :
//   //     - Bureau(x) : nombre, type, matériau, dimensions si précisées
//   //     - Chaises/fauteuils : nombre, type
//   //     - Tables : nombre, type (réunion, cuisine, etc.)
//   //     - Armoires/rangements : nombre, type, dimensions
//   //     - Étagères/bibliothèques : nombre, description
//   //     - Autres meubles listés

//   //     ÉLECTROMÉNAGER ET CUISINE :
//   //     - Réfrigérateur/congélateur : marque, modèle si précisés
//   //     - Four, micro-ondes : type
//   //     - Plaques de cuisson : type (gaz, électrique, induction)
//   //     - Lave-vaisselle : présence
//   //     - Machine à café : type
//   //     - Autres équipements de cuisine

//   //     ÉQUIPEMENTS TECHNIQUES :
//   //     - Ordinateurs, serveurs : nombre, configuration
//   //     - Téléphones fixes : nombre d'équipements
//   //     - Imprimantes, photocopieurs : type, nombre
//   //     - Équipement audiovisuel : écrans, projecteurs, vidéoprojecteurs
//   //     - Matériel réseau : switch, routeurs, bornes WiFi

//   //     INSTALLATIONS SPÉCIFIQUES :
//   //     - Système d'alarme : type, fournisseur, niveau de protection
//   //     - Vidéosurveillance : nombre de caméras, enregistreur
//   //     - Contrôle d'accès : badges, biométrie, interphone
//   //     - Coffre-fort : dimensions, niveau de sécurité
//   //     - Système téléphonique (PABX, standard)

//   //     ÉQUIPEMENTS DE CONFORT :
//   //     - Climatisation : type, puissance, zones couvertes
//   //     - Chauffage : type d'émetteurs (radiateurs, plancher chauffant, etc.)
//   //     - Stores, rideaux, volets : type, commande (manuelle, électrique)
//   //     - Revêtements de sol : type (moquette, parquet, carrelage, etc.)

//   //     AMÉNAGEMENTS EXTÉRIEURS (si applicable) :
//   //     - Mobilier de terrasse
//   //     - Stores extérieurs, parasols
//   //     - Éclairage extérieur
//   //     - Plantations, jardinières

//   //     ÉTAT ET CONDITION :
//   //     - État général mentionné (neuf, bon état, usagé)
//   //     - Garanties ou SAV mentionnés
//   //     - Date d'achat ou d'installation si précisée

//   //     INVENTAIRE ANNEXÉ :
//   //     - Référence à un inventaire détaillé en annexe
//   //     - État des lieux d'entrée mentionnant les équipements

//   //     CLAUSE DE PROPRIÉTÉ :
//   //     - Préciser si les équipements restent propriété du bailleur
//   //     - Obligations d'entretien et de remplacement
//   //     - Sort des équipements en fin de bail

//   //     Si les locaux sont loués non meublés et sans équipement, indiquer clairement : "Locaux loués vides, sans mobilier ni équipement".`,
//   //     expectedFormat: "structured_inventory",
//   //   },

//   //   {
//   //     id: "equipements_techniques_immobiliers",
//   //     query: `Détailler tous les équipements techniques et installations immobilières :

//   //     SYSTÈMES DE CHAUFFAGE :
//   //     - Type : individuel/collectif
//   //     - Énergie : gaz, électrique, fioul, pompe à chaleur, géothermie
//   //     - Équipements : chaudière (marque, puissance, année), radiateurs (nombre, type)
//   //     - Programmation et régulation
//   //     - Entretien : qui en a la charge, fréquence

//   //     SYSTÈMES DE CLIMATISATION/RAFRAÎCHISSEMENT :
//   //     - Type : individuel/collectif, split, VRV, centrale
//   //     - Puissance et BTU
//   //     - Nombre d'unités intérieures et extérieures
//   //     - Zones climatisées
//   //     - Entretien et maintenance

//   //     INSTALLATIONS ÉLECTRIQUES :
//   //     - Puissance souscrite ou disponible (en kVA)
//   //     - Tableau électrique : emplacement, nombre de disjoncteurs
//   //     - Nombre de prises électriques par pièce
//   //     - Éclairage : type (néon, LED), nombre de points lumineux
//   //     - Conformité aux normes (date du dernier diagnostic électrique)

//   //     PLOMBERIE ET SANITAIRES :
//   //     - Nombre de points d'eau
//   //     - Nombre de WC (séparés, dans salle d'eau)
//   //     - Nombre de lavabos/vasques
//   //     - Douche(s)/baignoire(s) : nombre
//   //     - Chauffe-eau : type (électrique, gaz), capacité, emplacement
//   //     - Production d'eau chaude : individuelle/collective

//   //     VENTILATION :
//   //     - Type : VMC simple flux, double flux, extraction naturelle
//   //     - Bouches d'extraction : nombre et localisation
//   //     - Entretien et nettoyage

//   //     TÉLÉCOMMUNICATIONS ET RÉSEAU :
//   //     - Câblage informatique : catégorie (Cat5, Cat6, fibre optique)
//   //     - Nombre de prises RJ45 par pièce
//   //     - Baies de brassage, armoires réseau
//   //     - Installation téléphonique : nombre de lignes, prises
//   //     - Fibre optique : disponibilité, débit, opérateur
//   //     - Antenne TV/satellite

//   //     SÉCURITÉ INCENDIE :
//   //     - Détecteurs de fumée : nombre et localisation
//   //     - Extincteurs : nombre, type, emplacement
//   //     - Système de désenfumage
//   //     - Issues de secours, signalétique
//   //     - Éclairage de sécurité
//   //     - Registre de sécurité et vérifications périodiques

//   //     ASCENSEUR(S) :
//   //     - Nombre d'ascenseurs
//   //     - Capacité (nombre de personnes, charge en kg)
//   //     - Étages desservis
//   //     - Marque et année d'installation
//   //     - Contrat d'entretien : fréquence, prestataire

//   //     AUTRES INSTALLATIONS :
//   //     - Système d'arrosage automatique
//   //     - Portail électrique, porte de garage automatique
//   //     - Adoucisseur d'eau
//   //     - Panneaux solaires
//   //     - Borne de recharge véhicule électrique

//   //     Préciser pour chaque équipement : état, âge approximatif, responsabilité d'entretien.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "etat_locaux_garnissement",
//   //     query: `Extraire toutes les clauses relatives à l'état des locaux, aux travaux et aux conditions de garnissement :

//   //     ÉTAT DES LOCAUX À L'ENTRÉE :
//   //     - Description générale de l'état (neuf, bon état, à rafraîchir, etc.)
//   //     - Défauts ou malfaçons signalés
//   //     - Référence à l'état des lieux d'entrée (annexé ou à réaliser)
//   //     - Date prévue de l'état des lieux
//   //     - Contradictoire ou non

//   //     TRAVAUX À LA CHARGE DU BAILLEUR :
//   //     - Travaux à réaliser avant ou lors de la remise des locaux
//   //     - Nature des travaux (peinture, sols, électricité, plomberie, etc.)
//   //     - Délai de réalisation
//   //     - Budget ou estimation
//   //     - Conséquences en cas de non-réalisation

//   //     TRAVAUX À LA CHARGE DU PRENEUR :
//   //     - Travaux d'aménagement autorisés ou imposés
//   //     - Travaux d'adaptation à l'activité
//   //     - Limitations et interdictions
//   //     - Nécessité d'autorisation préalable du bailleur
//   //     - Conditions de cette autorisation (écrite, délai de réponse)

//   //     AMÉNAGEMENTS ET TRANSFORMATIONS :
//   //     - Modifications autorisées (cloisons, sols, plafonds, façade)
//   //     - Modifications interdites (structure, réseaux principaux, etc.)
//   //     - Obligation de remettre en état ou possibilité de laisser en place
//   //     - Règles concernant les enseignes et vitrines
//   //     - Modifications des équipements techniques

//   //     ENTRETIEN COURANT :
//   //     - Définition des réparations locatives à charge du preneur
//   //     - Obligations d'entretien régulier (peinture, revêtements, etc.)
//   //     - Fréquence imposée pour certains entretiens

//   //     GROS TRAVAUX ET GROSSES RÉPARATIONS :
//   //     - Définition et répartition (article 606 du Code civil)
//   //     - Travaux restant à charge du bailleur
//   //     - Procédure en cas de nécessité de gros travaux

//   //     REMISE EN ÉTAT EN FIN DE BAIL :
//   //     - Obligation de restituer les locaux en bon état
//   //     - Vétusté admise ou non
//   //     - Travaux de remise en état imposés
//   //     - Sort des aménagements réalisés par le preneur
//   //     - Clause de reprise des aménagements par le bailleur
//   //     - Indemnisation éventuelle pour les travaux non amortis

//   //     AUTORISATIONS ADMINISTRATIVES :
//   //     - Permis de construire ou déclaration préalable nécessaires
//   //     - Autorisation de la copropriété
//   //     - Autorisations d'urbanisme
//   //     - Responsabilité des démarches administratives

//   //     CONTRÔLE ET INSPECTION :
//   //     - Droit de visite du bailleur pendant les travaux
//   //     - Obligation de conformité aux règles de l'art
//   //     - Recours à des professionnels qualifiés
//   //     - Assurances obligatoires (décennale, etc.)

//   //     Citer les clauses exactes du bail concernant l'état et le garnissement.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   // ============================================
//   //   // 7. DURÉE ET CONDITIONS DU BAIL
//   //   // ============================================
//   //   {
//   //     id: "duree_bail",
//   //     query: `Extraire toutes les informations relatives à la durée du bail :

//   //     DATES :
//   //     - Date de prise d'effet du bail (date d'entrée en jouissance)
//   //     - Date de signature du bail
//   //     - Durée initiale du bail (en années, mois, jours)
//   //     - Date d'échéance du bail (terme)
//   //     - Différence entre date de signature et date d'effet si applicable

//   //     TYPE DE DURÉE :
//   //     - Bail à durée déterminée ou indéterminée
//   //     - Durée ferme (sans possibilité de résiliation anticipée)
//   //     - Périodes et échéances triennales (3, 6, 9 ans pour baux commerciaux)

//   //     RENOUVELLEMENT :
//   //     - Conditions de renouvellement (tacite, express)
//   //     - Durée du renouvellement
//   //     - Délai de préavis pour refus de renouvellement
//   //     - Indemnité d'éviction en cas de refus de renouvellement

//   //     PÉRIODE D'ESSAI OU PRÉCARITÉ :
//   //     - Bail précaire : durée maximale (généralement 2 ans)
//   //     - Motif de précarité si mentionné
//   //     - Possibilité de transformation en bail classique

//   //     RÉSILIATION ANTICIPÉE :
//   //     - Possibilité de résiliation anticipée pour le preneur (congé triennal en bail commercial)
//   //     - Possibilité de résiliation anticipée pour le bailleur (conditions strictes)
//   //     - Délai de préavis (6 mois généralement en commercial)
//   //     - Conditions de la résiliation (motif, forme, délai)
//   //     - Pénalités éventuelles en cas de résiliation anticipée

//   //     RECONDUCTION :
//   //     - Clause de reconduction tacite
//   //     - Transformation en bail à durée indéterminée

//   //     Citer les clauses exactes relatives à la durée.`,
//   //     expectedFormat: "structured",
//   //   },

//   //   {
//   //     id: "loyer_montant",
//   //     query: `Extraire toutes les informations financières relatives au loyer :

//   //     LOYER PRINCIPAL :
//   //     - Montant du loyer annuel (en euros ou autre devise)
//   //     - Montant du loyer mensuel
//   //     - Montant du loyer au m² (calculer si possible)
//   //     - TVA : applicable ou non, taux si applicable
//   //     - Montant TTC si TVA applicable

//   //     DÉCOMPOSITION DU LOYER :
//   //     - Loyer de base (ou loyer principal)
//   //     - Loyers accessoires ou complémentaires si distincts
//   //     - Part du loyer pour les annexes (parking, cave) si séparée

//   //     CHARGES LOCATIVES :
//   //     - Provisions sur charges : montant mensuel ou annuel
//   //     - Nature des charges récupérables (liste détaillée)
//   //     - Charges forfaitaires ou réelles avec régularisation
//   //     - Fréquence de régularisation (annuelle généralement)
//   //     - Charges de copropriété : répartition bailleur/preneur

//   //     TAXES ET IMPÔTS :
//   //     - Taxe foncière : à charge du bailleur ou du preneur
//   //     - Taxe d'enlèvement des ordures ménagères (TEOM) : répartition
//   //     - Taxes spécifiques (bureaux, commerces, etc.)
//   //     - Cotisation foncière des entreprises (CFE) : information

//   //     DÉPÔT DE GARANTIE :
//   //     - Montant du dépôt de garantie (généralement 3 mois de loyer HC pour un bail commercial)
//   //     - Conditions de restitution en fin de bail
//   //     - Possibilité d'actualisation du dépôt
//   //     - Compte bloqué ou non
//   //     - Intérêts éventuels

//   //     FRANCHISE DE LOYER :
//   //     - Période de franchise totale (nombre de mois sans loyer)
//   //     - Période de franchise partielle (loyer réduit)
//   //     - Conditions de la franchise

//   //     LOYER INITIAL VS LOYER DE MARCHÉ :
//   //     - Référence à un loyer de référence ou de marché
//   //     - Déplafonnement éventuel

//   //     Présenter les montants en tableau avec calculs.`,
//   //     expectedFormat: "structured_financial",
//   //   },

//   //   {
//   //     id: "revision_indexation",
//   //     query: `Extraire toutes les clauses de révision, d'indexation et d'évolution du loyer :

//   //     INDEXATION ANNUELLE :
//   //     - Indice de référence utilisé (ILC, ILAT, ICC, indice du coût de la construction, etc.)
//   //     - Organisme publiant l'indice (INSEE généralement)
//   //     - Périodicité de la révision (annuelle, trimestrielle, etc.)
//   //     - Date de révision (date anniversaire du bail, 1er janvier, etc.)
//   //     - Formule de calcul de l'indexation
//   //     - Indice de référence de départ (trimestre/année)
//   //     - Plafonnement éventuel de la variation

//   //     RÉVISION TRIENNALE (bail commercial) :
//   //     - Possibilité de révision tous les 3 ans
//   //     - Conditions de la révision (accord des parties, décision judiciaire)
//   //     - Référence à la valeur locative de marché
//   //     - Plafonnement de la variation (généralement indice + 10%)
//   //     - Procédure contradictoire avec commissaire ou expert

//   //     RÉVISION POUR MODIFICATION :
//   //     - Révision en cas de travaux d'amélioration
//   //     - Révision en cas de changement de destination
//   //     - Révision en cas de modification de surface

//   //     CLAUSES PARTICULIÈRES :
//   //     - Clause de loyer variable selon le chiffre d'affaires (pour commerces)
//   //     - Loyer minimum garanti + partie variable
//   //     - Paliers de loyer programmés
//   //     - Loyer progressif sur les premières années

//   //     DÉPLAFONNEMENT :
//   //     - Conditions du déplafonnement du loyer
//   //     - Modification notable des caractéristiques du local
//   //     - Changement d'activité
//   //     - Renouvellement du bail

//   //     BLOCAGE OU GEL :
//   //     - Périodes de gel du loyer
//   //     - Engagement de non-révision

//   //     Citer les clauses exactes d'indexation et les formules de calcul.`,
//   //     expectedFormat: "structured",
//   //   },

//   //   // ============================================
//   //   // 8. CLAUSES SPÉCIFIQUES ET RÉGLEMENTAIRES
//   //   // ============================================
//   //   {
//   //     id: "enseigne_vitrine",
//   //     query: `Extraire exhaustivement toutes les clauses relatives à l'enseigne, la vitrine, la devanture et la signalétique :

//   //     DROIT À L'ENSEIGNE :
//   //     - Autorisation ou interdiction de poser une enseigne
//   //     - Types d'enseignes autorisés (drapeau, bandeau, caisson lumineux, etc.)
//   //     - Nombre d'enseignes autorisées

//   //     CARACTÉRISTIQUES AUTORISÉES :
//   //     - Dimensions maximales (hauteur, largeur, surface)
//   //     - Emplacement précis autorisé (façade, vitrine, perpendiculaire, toit, etc.)
//   //     - Saillie maximale par rapport à la façade (en cm)
//   //     - Hauteur par rapport au sol (minimum et maximum)

//   //     ASPECTS ESTHÉTIQUES :
//   //     - Couleurs autorisées ou imposées (respect de la charte du bâtiment)
//   //     - Matériaux autorisés (bois, métal, PVC, toile, etc.)
//   //     - Style architectural à respecter
//   //     - Harmonie avec la façade ou les autres enseignes
//   //     - Interdiction de certains matériaux ou couleurs

//   //     ÉCLAIRAGE :
//   //     - Enseigne lumineuse : autorisation ou interdiction
//   //     - Type d'éclairage autorisé (LED, néon, projecteurs, etc.)
//   //     - Puissance maximale
//   //     - Horaires d'extinction obligatoires (réglementation publicité extérieure)
//   //     - Consommation électrique et raccordement

//   //     CONTENU ET MESSAGE :
//   //     - Obligation de mentionner le nom commercial exact
//   //     - Interdiction de messages publicitaires
//   //     - Interdiction de mentions trompeuses
//   //     - Limitation du nombre de mots ou de logos

//   //     AUTORISATIONS ADMINISTRATIVES :
//   //     - Nécessité d'une autorisation préalable du bailleur (délai de réponse)
//   //     - Déclaration préalable en mairie obligatoire
//   //     - Autorisation de l'Architecte des Bâtiments de France (ABF) si secteur protégé
//   //     - Autorisation de la copropriété
//   //     - Permis de construire ou déclaration préalable selon dimensions

//   //     INSTALLATION ET FIXATION :
//   //     - Obligation de recourir à un professionnel qualifié
//   //     - Interdiction de percer la façade ou conditions strictes
//   //     - Système de fixation imposé
//   //     - Respect des normes de sécurité (résistance au vent, etc.)
//   //     - Assurance responsabilité civile pour l'installation

//   //     ENTRETIEN :
//   //     - Obligation d'entretien régulier de l'enseigne
//   //     - Réparation et remplacement en cas de dégradation
//   //     - Nettoyage périodique

//   //     VITRINE ET DEVANTURE :
//   //     - Aménagement de la vitrine : autorisations et restrictions
//   //     - Affichage dans la vitrine : dimensions, contenu autorisé
//   //     - Occultation partielle ou totale : interdiction ou conditions
//   //     - Stores, bannes : type, couleur, dimensions
//   //     - Modification de la devanture (peinture, revêtement) : conditions

//   //     RETRAIT EN FIN DE BAIL :
//   //     - Obligation de déposer l'enseigne en fin de bail
//   //     - Remise en état de la façade (rebouchage des trous, repeinture)
//   //     - Délai pour effectuer le retrait
//   //     - Pénalités en cas de non-retrait

//   //     INTERDICTIONS SPÉCIFIQUES :
//   //     - Interdiction d'enseignes clignotantes
//   //     - Interdiction de publicité ou propagande politique
//   //     - Interdiction d'affichages sauvages sur la façade

//   //     CONFORMITÉ RÉGLEMENTAIRE :
//   //     - Respect du Règlement Local de Publicité (RLP)
//   //     - Conformité au PLU
//   //     - Respect de la Charte de qualité d'un centre commercial si applicable

//   //     Citer textuellement toutes les clauses relatives à l'enseigne et à la vitrine.
//   //     Indiquer "Aucune clause spécifique concernant l'enseigne" si le bail ne mentionne rien à ce sujet.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "diagnostics_techniques",
//   //     query: `Lister tous les diagnostics techniques obligatoires annexés au bail :

//   //     DIAGNOSTIC DE PERFORMANCE ÉNERGÉTIQUE (DPE) :
//   //     - Date de réalisation
//   //     - Classe énergétique (A à G)
//   //     - Classe GES (Gaz à Effet de Serre)
//   //     - Consommation énergétique annuelle estimée
//   //     - Nom du diagnostiqueur et numéro de certification
//   //     - Date de validité (10 ans)
//   //     - Recommandations de travaux

//   //     AMIANTE :
//   //     - Date du diagnostic amiante
//   //     - Présence d'amiante : oui/non
//   //     - Localisation si présence
//   //     - Niveau de risque
//   //     - Date de validité (illimitée si absence, 3 ans si présence)

//   //     PLOMB (CREP - Constat de Risque d'Exposition au Plomb) :
//   //     - Applicable si construction avant 1949
//   //     - Date du diagnostic
//   //     - Présence de plomb : oui/non
//   //     - Localisation si présence

//   //     TERMITES :
//   //     - Date du diagnostic termites
//   //     - Présence de termites : oui/non
//   //     - Zone géographique à risque
//   //     - Date de validité (6 mois)

//   //     GAZ :
//   //     - Date du diagnostic gaz
//   //     - État de l'installation
//   //     - Anomalies détectées
//   //     - Date de validité (3 ans)

//   //     ÉLECTRICITÉ :
//   //     - Date du diagnostic électrique
//   //     - État de l'installation
//   //     - Anomalies détectées
//   //     - Conformité aux normes
//   //     - Date de validité (3 ans)

//   //     ERNT (État des Risques Naturels et Technologiques) ou ERNMT :
//   //     - Date de réalisation
//   //     - Risques identifiés (inondation, séisme, industriel, etc.)
//   //     - Sinistres antérieurs indemnisés
//   //     - Date de validité (6 mois)

//   //     MESURAGE LOI CARREZ :
//   //     - Date du mesurage
//   //     - Surface exacte mesurée
//   //     - Nom du géomètre
//   //     - Validité (illimitée sauf modification)

//   //     AUTRES DIAGNOSTICS :
//   //     - Mérules (champignons)
//   //     - Radon
//   //     - ERP (État des Risques et Pollutions) - remplace l'ERNMT
//   //     - Diagnostic déchets avant démolition

//   //     ANNEXION AU BAIL :
//   //     - Confirmation que tous les diagnostics sont annexés
//   //     - Référence aux annexes
//   //     - Mention de la remise effective au preneur

//   //     Indiquer "Non communiqué" ou "Non applicable" pour chaque diagnostic absent.`,
//   //     expectedFormat: "structured_list",
//   //   },

//   //   {
//   //     id: "assurances",
//   //     query: `Extraire toutes les obligations d'assurance stipulées dans le bail :

//   //     ASSURANCE DU PRENEUR :
//   //     - Obligation d'assurance : oui/non
//   //     - Types d'assurances obligatoires :
//   //       * Responsabilité civile locative
//   //       * Dommages aux biens (contenu, matériel, stock)
//   //       * Recours des voisins et tiers
//   //       * Perte d'exploitation (obligation ou recommandation)
//   //       * Responsabilité civile professionnelle
//   //       * Multirisque professionnelle

//   //     GARANTIES MINIMALES EXIGÉES :
//   //     - Montants minimaux de garantie (en euros)
//   //     - Risques devant être couverts (incendie, dégât des eaux, explosion, etc.)
//   //     - Extensions de garantie requises

//   //     JUSTIFICATIFS :
//   //     - Obligation de fournir une attestation d'assurance
//   //     - Fréquence (à la signature, puis annuellement)
//   //     - Délai de fourniture
//   //     - Contenu de l'attestation (montants de garantie, risques couverts)

//   //     DÉSIGNATION DU BAILLEUR :
//   //     - Le bailleur doit-il être désigné comme bénéficiaire ou tiers dans le contrat ?

//   //     CONSÉQUENCES EN CAS DE DÉFAUT D'ASSURANCE :
//   //     - Résiliation possible du bail
//   //     - Assurance souscrite par le bailleur aux frais du preneur
//   //     - Majoration ou pénalité

//   //     ASSURANCE DU BAILLEUR :
//   //     - Assurance de l'immeuble par le bailleur
//   //     - Responsabilité civile du propriétaire
//   //     - Assurance des parties communes en copropriété
//   //     - Information sur la répartition des primes d'assurance

//   //     SINISTRES :
//   //     - Obligation de déclarer immédiatement tout sinistre
//   //     - Procédure en cas de sinistre
//   //     - Franchise éventuelle à charge du preneur

//   //     Citer les clauses exactes relatives aux assurances.`,
//   //     expectedFormat: "structured",
//   //   },

//   //   {
//   //     id: "charges_repartition",
//   //     query: `Détailler la répartition complète des charges et des dépenses entre bailleur et preneur :

//   //     CHARGES LOCATIVES RÉCUPÉRABLES AUPRÈS DU PRENEUR :
//   //     - Entretien des parties communes (nettoyage, éclairage)
//   //     - Entretien des espaces verts
//   //     - Gardiennage, concierge
//   //     - Enlèvement des ordures ménagères (taxe ou prestation)
//   //     - Eau froide et eau chaude collective
//   //     - Chauffage et climatisation collectifs
//   //     - Ascenseur (entretien, électricité, petites réparations)
//   //     - Entretien des équipements communs (interphone, digicode, etc.)
//   //     - Entretien de la VMC collective
//   //     - Désinsectisation, dératisation

//   //     CHARGES DE COPROPRIÉTÉ :
//   //     - Charges courantes de copropriété
//   //     - Quote-part du budget prévisionnel
//   //     - Régularisation annuelle
//   //     - Tantièmes de charges

//   //     TRAVAUX ET GROSSES RÉPARATIONS :
//   //     - Gros travaux de copropriété : répartition (souvent à charge du bailleur)
//   //     - Travaux d'amélioration votés en AG : répartition
//   //     - Réparations structurelles de l'immeuble
//   //     - Ravalement de façade
//   //     - Réfection de la toiture
//   //     - Mise aux normes des installations collectives

//   //     IMPÔTS ET TAXES :
//   //     - Taxe foncière : à charge du bailleur (principe)
//   //     - TEOM (Taxe d'Enlèvement des Ordures Ménagères) : récupérable auprès du preneur
//   //     - Taxes spécifiques locales
//   //     - Taxe bureaux/commerces en Île-de-France : répartition

//   //     ENTRETIEN ET RÉPARATIONS DES LOCAUX PRIVATIFS :
//   //     - Entretien courant : à charge du preneur (liste précise)
//   //     - Réparations locatives (article 1754 du Code civil)
//   //     - Remplacement des équipements vétustes : à charge du bailleur
//   //     - Grosses réparations (article 606 du Code civil) : à charge du bailleur

//   //     FLUIDES ET ÉNERGIES :
//   //     - Électricité des locaux privatifs : souscription par le preneur
//   //     - Gaz : souscription par le preneur
//   //     - Eau : compteur individuel ou quote-part
//   //     - Chauffage : individuel (preneur) ou collectif avec répartition

//   //     HONORAIRES ET FRAIS ADMINISTRATIFS :
//   //     - Honoraires du syndic : répartis selon tantièmes
//   //     - Frais de gestion locative si mandat : à charge de qui ?
//   //     - Frais de rédaction du bail et d'enregistrement : répartition

//   //     MODALITÉS DE PAIEMENT DES CHARGES :
//   //     - Provisions mensuelles ou trimestrielles
//   //     - Régularisation annuelle : périodicité, modalités
//   //     - Délai de communication des décomptes
//   //     - Justificatifs et possibilité de consultation

//   //     LITIGES SUR LES CHARGES :
//   //     - Procédure de contestation
//   //     - Délai pour contester

//   //     Présenter la répartition sous forme de tableau : Charges / Bailleur / Preneur / Observations.`,
//   //     expectedFormat: "structured_table",
//   //   },

//   //   {
//   //     id: "travaux_obligations",
//   //     query: `Détailler toutes les obligations de travaux incombant à chaque partie :

//   //     TRAVAUX À LA CHARGE DU BAILLEUR :
//   //     - Gros œuvre et structure (fondations, murs porteurs, charpente, toiture)
//   //     - Ravalement et façades
//   //     - Parties communes de l'immeuble
//   //     - Mise en conformité avec les normes de sécurité et accessibilité
//   //     - Remplacement des équipements vétustes (chaudière, installations électriques obsolètes)
//   //     - Grosses réparations (article 606 du Code civil) : liste exhaustive
//   //     - Travaux rendus nécessaires par vétusté ou force majeure
//   //     - Travaux d'amélioration de la performance énergétique (selon législation en vigueur)

//   //     TRAVAUX À LA CHARGE DU PRENEUR :
//   //     - Réparations locatives (article 1754 du Code civil)
//   //     - Entretien courant des locaux privatifs (peinture, revêtements de sols, etc.)
//   //     - Entretien des équipements dont il a la jouissance exclusive
//   //     - Petites réparations des équipements (robinetterie, interrupteurs, etc.)
//   //     - Remplacement des consommables (ampoules, joints, etc.)
//   //     - Entretien des installations de chauffage/climatisation privatives
//   //     - Ramonage des cheminées le cas échéant
//   //     - Travaux d'aménagement intérieur (avec autorisation)
//   //     - Remise en état en fin de bail

//   //     TRAVAUX NÉCESSITANT UNE AUTORISATION PRÉALABLE :
//   //     - Modifications de la distribution des locaux
//   //     - Percement de murs (même non porteurs)
//   //     - Modifications des installations électriques ou de plomberie
//   //     - Travaux touchant la façade ou les parties communes
//   //     - Installation d'équipements lourds
//   //     - Changement d'affectation de certaines pièces

//   //     PROCÉDURE D'AUTORISATION :
//   //     - Demande écrite au bailleur avec descriptif des travaux
//   //     - Plans et devis si nécessaires
//   //     - Délai de réponse du bailleur
//   //     - Silence valant acceptation ou refus ?
//   //     - Recours en cas de refus abusif

//   //     MODALITÉS D'EXÉCUTION DES TRAVAUX :
//   //     - Obligation de recourir à des professionnels qualifiés
//   //     - Assurances obligatoires (garantie décennale, responsabilité civile)
//   //     - Respect des normes en vigueur
//   //     - Horaires des travaux (respect du voisinage)
//   //     - Information du bailleur du démarrage des travaux

//   //     TRAVAUX URGENTS :
//   //     - Définition des travaux urgents
//   //     - Procédure accélérée
//   //     - Possibilité pour le preneur d'agir sans autorisation préalable
//   //     - Remboursement ou imputation sur le loyer

//   //     TRAVAUX IMPOSÉS PAR LA RÉGLEMENTATION :
//   //     - Mise aux normes accessibilité (ERP)
//   //     - Mise aux normes sécurité incendie
//   //     - Répartition des coûts entre bailleur et preneur

//   //     INDEMNISATION POUR TROUBLES DE JOUISSANCE :
//   //     - Réduction de loyer en cas de travaux importants du bailleur
//   //     - Conditions et durée

//   //     Citer les clauses exactes du bail relatives aux travaux.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "cession_sous_location",
//   //     query: `Extraire toutes les clauses relatives à la cession du bail, à la cession du fonds de commerce et à la sous-location :

//   //     CESSION DU BAIL :
//   //     - Cession libre ou soumise à autorisation du bailleur
//   //     - Conditions de la cession (agrément du cessionnaire)
//   //     - Procédure d'agrément : délai, modalités
//   //     - Critères d'acceptation ou de refus du cessionnaire
//   //     - Cession possible uniquement avec le fonds de commerce ?
//   //     - Droit de préemption du bailleur
//   //     - Formalités à accomplir (notification, acte notarié)

//   //     CESSION DU FONDS DE COMMERCE :
//   //     - Cession du bail avec le fonds : automatique ou sous conditions
//   //     - Agrément du cessionnaire nécessaire ou non (en principe non en bail commercial)
//   //     - Notification au bailleur : délai et forme
//   //     - Solidarité de l'ancien et du nouveau preneur : durée (généralement 3 ans)
//   //     - Droit de préférence du bailleur

//   //     SOUS-LOCATION :
//   //     - Sous-location totale : autorisée/interdite/sous conditions
//   //     - Sous-location partielle : autorisée/interdite/sous conditions
//   //     - Autorisation préalable du bailleur nécessaire : procédure
//   //     - Montant du loyer de sous-location : libre ou plafonné
//   //     - Responsabilité du preneur principal (solidarité)
//   //     - Obligations du sous-locataire
//   //     - Résiliation de la sous-location

//   //     CLAUSE D'AGRÉMENT :
//   //     - Agrément du bailleur systématique
//   //     - Délais de réponse (généralement 2 mois)
//   //     - Silence valant acceptation ou refus ?
//   //     - Critères d'appréciation (solvabilité, activité, etc.)
//   //     - Possibilité de refus : motifs légitimes

//   //     DROIT DE PRÉEMPTION OU DE PRÉFÉRENCE :
//   //     - Le bailleur dispose-t-il d'un droit de préemption en cas de vente du fonds ?
//   //     - Conditions d'exercice
//   //     - Délai pour exercer ce droit
//   //     - Prix et conditions de la préemption

//   //     CONDITIONS FINANCIÈRES :
//   //     - Droit d'entrée ou indemnité au bailleur en cas de cession
//   //     - Honoraires et frais de cession : répartition
//   //     - Enregistrement de l'acte de cession

//   //     INTERDICTIONS :
//   //     - Interdiction de cession sans le fonds de commerce
//   //     - Interdiction de démembrement du bail
//   //     - Activité du cessionnaire devant être identique ou compatible

//   //     RÉSILIATION EN CAS DE CESSION IRRÉGULIÈRE :
//   //     - Conséquences d'une cession non autorisée
//   //     - Résiliation du bail possible
//   //     - Dommages et intérêts

//   //     Citer textuellement toutes les clauses relatives à la cession et à la sous-location.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "resiliation_conges",
//   //     query: `Extraire toutes les clauses relatives à la résiliation, aux congés et à la fin du bail :

//   //     RÉSILIATION PAR LE PRENEUR :
//   //     - Possibilité de donner congé : à quelle(s) échéance(s)
//   //     - Délai de préavis (6 mois pour bail commercial, variable pour autres)
//   //     - Forme du congé (lettre recommandée avec AR, acte d'huissier)
//   //     - Congé avec ou sans indemnité
//   //     - Conditions spécifiques (motif, justification)

//   //     RÉSILIATION PAR LE BAILLEUR :
//   //     - Possibilité limitée de donner congé (bail commercial)
//   //     - Motifs légitimes et sérieux requis
//   //     - Indemnité d'éviction si refus de renouvellement (bail commercial)
//   //     - Montant de l'indemnité : calcul, évaluation
//   //     - Exceptions à l'indemnité d'éviction (motifs graves, reconstruction)

//   //     RÉSILIATION POUR MANQUEMENT :
//   //     - Résiliation pour défaut de paiement du loyer
//   //     - Clause résolutoire : conditions de déclenchement
//   //     - Commandement de payer : délai de régularisation
//   //     - Autres motifs de résiliation (non-assurance, troubles de voisinage, défaut d'entretien, etc.)
//   //     - Procédure judiciaire ou clause résolutoire de plein droit

//   //     RENOUVELLEMENT DU BAIL (bail commercial) :
//   //     - Droit au renouvellement du preneur (principe de la propriété commerciale)
//   //     - Demande de renouvellement : délai (6 mois avant échéance)
//   //     - Forme de la demande
//   //     - Réponse du bailleur : délai (3 mois)
//   //     - Fixation du loyer du bail renouvelé
//   //     - Durée du bail renouvelé (minimum 9 ans)

//   //     REFUS DE RENOUVELLEMENT :
//   //     - Motifs de refus légitimes (démolition, reconstruction, réalisation de travaux)
//   //     - Motifs graves et légitimes contre le preneur
//   //     - Indemnité d'éviction due au preneur
//   //     - Calcul de l'indemnité (valeur du fonds, frais de déménagement, etc.)
//   //     - Procédure d'évaluation contradictoire

//   //     FIN DU BAIL :
//   //     - État des lieux de sortie : obligatoire, contradictoire
//   //     - Délai de réalisation
//   //     - Remise des clés
//   //     - Restitution du dépôt de garantie : délai, retenues éventuelles

//   //     OBLIGATIONS DE REMISE EN ÉTAT :
//   //     - Remise en état des locaux en fin de bail
//   //     - Travaux à effectuer par le preneur
//   //     - Vétusté admise ou non
//   //     - Retenue sur le dépôt de garantie pour non-respect

//   //     MAINTIEN DANS LES LIEUX :
//   //     - Possibilité de rester dans les lieux après expiration en attendant renouvellement
//   //     - Conséquences du maintien (tacite reconduction, indemnité d'occupation)

//   //     LITIGES :
//   //     - Clause compromissoire : arbitrage ou médiation
//   //     - Juridiction compétente
//   //     - Procédure en cas de désaccord sur le renouvellement ou le loyer

//   //     Citer les clauses exactes relatives à la résiliation et au renouvellement.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "clauses_particulieres",
//   //     query: `Identifier toutes les clauses particulières, spécifiques ou atypiques du bail :

//   //     CLAUSES FINANCIÈRES SPÉCIFIQUES :
//   //     - Clause de loyer variable selon le chiffre d'affaires
//   //     - Droit d'entrée (pas de porte)
//   //     - Franchise de loyer ou loyer progressif
//   //     - Clause d'échelle mobile particulière
//   //     - Pénalités de retard spécifiques

//   //     CLAUSES RESTRICTIVES :
//   //     - Clause d'exclusivité d'activité pour le preneur
//   //     - Clause de non-concurrence (pour le preneur dans une zone géographique)
//   //     - Interdiction de certaines activités annexes
//   //     - Restrictions d'horaires d'ouverture
//   //     - Obligations de fermeture (jours fériés, etc.)

//   //     CLAUSES DE PERFORMANCE :
//   //     - Obligation de chiffre d'affaires minimum
//   //     - Obligation d'exploitation effective et continue
//   //     - Indicateurs de performance à respecter
//   //     - Conséquences en cas de non-respect

//   //     OBLIGATIONS SPÉCIFIQUES D'EXPLOITATION :
//   //     - Obligation d'adhérer à une association de commerçants
//   //     - Participation à des actions commerciales communes
//   //     - Respect d'une charte graphique ou esthétique (centre commercial)
//   //     - Horaires d'ouverture imposés (notamment en centre commercial)

//   //     CLAUSES DE SOLIDARITÉ OU DE CAUTIONNEMENT :
//   //     - Caution solidaire : identité du caution
//   //     - Montant garanti
//   //     - Durée de l'engagement de caution
//   //     - Clause de solidarité entre co-preneurs

//   //     CLAUSES ENVIRONNEMENTALES :
//   //     - Obligations en matière de tri des déchets
//   //     - Objectifs de réduction de consommation énergétique
//   //     - "Bail vert" (article L.125-9 du Code de l'environnement) : annexe environnementale
//   //     - Obligations de reporting énergétique

//   //     CLAUSES RELATIVES AU FONDS DE COMMERCE :
//   //     - Obligation de maintenir un fonds de commerce actif
//   //     - Interdiction de déplacer le fonds
//   //     - Valorisation du fonds en cas de résiliation

//   //     DROIT DE REPENTIR OU PÉRIODE D'ESSAI :
//   //     - Période durant laquelle l'une ou l'autre partie peut se rétracter
//   //     - Conditions et délais

//   //     CLAUSE PÉNALE :
//   //     - Pénalités en cas de manquement à certaines obligations
//   //     - Montant des pénalités

//   //     CLAUSE D'OPTION D'ACHAT :
//   //     - Possibilité pour le preneur d'acheter les locaux
//   //     - Prix et conditions
//   //     - Délai d'exercice de l'option

//   //     CLAUSES DE RÉEXAMEN PÉRIODIQUE :
//   //     - Rendez-vous périodiques pour revoir certaines conditions
//   //     - Fréquence (tous les 3, 5 ans, etc.)

//   //     CLAUSES DE CONFIDENTIALITÉ :
//   //     - Obligation de confidentialité sur les termes du bail
//   //     - Informations sensibles à protéger

//   //     FORCE MAJEURE :
//   //     - Définition de la force majeure
//   //     - Conséquences (suspension du loyer, résiliation, etc.)
//   //     - Cas particuliers (pandémie, catastrophe naturelle, etc.)

//   //     AUTRES CLAUSES ATYPIQUES :
//   //     - Toute clause inhabituelle ou spécifique non couverte ci-dessus

//   //     Citer intégralement chaque clause particulière identifiée.`,
//   //     expectedFormat: "structured_detailed",
//   //   },

//   //   {
//   //     id: "annexes_documents",
//   //     query: `Lister tous les documents annexés au bail et les références documentaires :

//   //     DOCUMENTS TECHNIQUES :
//   //     - État des lieux d'entrée (descriptif détaillé)
//   //     - Plans des locaux (avec échelle et côtes)
//   //     - Plans de masse et de situation
//   //     - Diagnostics techniques obligatoires (liste exhaustive déjà couverte)
//   //     - Mesurage Loi Carrez
//   //     - Schémas des installations électriques, plomberie, chauffage

//   //     DOCUMENTS ADMINISTRATIFS :
//   //     - Règlement de copropriété
//   //     - État descriptif de division (si copropriété)
//   //     - Procès-verbaux d'assemblée générale (derniers PV)
//   //     - Carnet d'entretien de l'immeuble
//   //     - Certificats de conformité (électricité, gaz, etc.)

//   //     DOCUMENTS FINANCIERS :
//   //     - Dernier décompte de charges
//   //     - Budget prévisionnel de la copropriété
//   //     - Feuille de calcul de la révision du loyer
//   //     - Quittances ou appels de fonds de copropriété

//   //     DOCUMENTS JURIDIQUES :
//   //     - Statuts de la société bailleresse (si personne morale)
//   //     - Extrait Kbis du bailleur et du preneur
//   //     - Pouvoir du mandataire le cas échéant
//   //     - Titre de propriété ou acte notarié
//   //     - Attestation de l'absence d'hypothèque ou privilège

//   //     INVENTAIRES :
//   //     - Inventaire du mobilier et équipements fournis
//   //     - État descriptif détaillé des locaux et équipements

//   //     ASSURANCES ET GARANTIES :
//   //     - Attestation d'assurance du bailleur (immeuble, RC propriétaire)
//   //     - Attestation d'assurance du preneur (à fournir)
//   //     - Acte de cautionnement solidaire ou garantie bancaire

//   //     AUTORISATIONS ET AGRÉMENTS :
//   //     - Autorisation d'urbanisme pour travaux antérieurs
//   //     - Licence ou agrément pour l'activité (licence IV, etc.)
//   //     - Autorisation préfectorale si ERP

//   //     DOCUMENTS ENVIRONNEMENTAUX :
//   //     - Annexe environnementale ("bail vert")
//   //     - Diagnostic de performance énergétique (DPE)
//   //     - État des servitudes et risques

//   //     CORRESPONDANCES :
//   //     - Lettres de notification
//   //     - Accords écrits antérieurs au bail

//   //     AUTRES ANNEXES :
//   //     - Cahier des charges spécifique (pour centre commercial, etc.)
//   //     - Charte graphique ou esthétique à respecter
//   //     - Mode d'emploi des équipements
//   //     - Procédure d'urgence (contacts, consignes)

//   //     Pour chaque document annexé, préciser :
//   //     - Titre exact
//   //     - Date si mentionnée
//   //     - Nombre de pages
//   //     - Numéro d'annexe
//   //     - Si le document est simplement mentionné ou effectivement annexé

//   //     Indiquer "Aucune annexe mentionnée" si le bail ne fait référence à aucun document annexe.`,
//   //     expectedFormat: "structured_list",
//   //   },
// ];

// Types pour les réponses
type RegimeJuridique =
  | "commercial"
  | "civil"
  | "précaire"
  | "dérogatoire"
  | "à construire"
  | "à construction"
  | "BEFA"

interface Coordonnees {
  nom?: string
  denomination?: string
  courriel?: string
  telephone?: string
  adresse?: string
  siret?: string
  siren?: string
}

interface RepresentantBailleur {
  nom?: string
  prenom?: string
  qualite?: string
  capital?: string
  adresse?: string
  representant_legal?: string
}

interface Preneur {
  nom?: string
  denomination?: string
  courriel?: string
  telephone?: string
  adresse?: string
  siret?: string
  siren?: string
  representant_legal?: string
}

interface ConditionsEnseigne {
  autorisation: boolean
  conditions?: string
  dimensions?: string
  emplacement?: string
  materiaux?: string
  autorisations_prealables?: string[]
}

interface Surface {
  designation?: string
  surface_m2: number
}

interface SurfaceLocaux {
  surface_totale_m2: number
  surfaces_detaillees?: Surface[]
  methode_mesure?: string
}

interface Cloisonnement {
  cloisonne: boolean
  nombre_locaux_cloisonnes?: number
  surfaces_cloisonnees?: Surface[]
  type_cloisons?: string
}

interface Mobilier {
  equipe: boolean
  liste_equipements?: string[]
  description?: string
}

// Interface principale pour une query
export interface BailQuery {
  id: string
  query: string
  expectedType: string
}

// Queries typées
export const bailQueries: BailQuery[] = [
  {
    id: "regime_juridique",
    query:
      "Quel est le régime juridique du bail parmi l'un des suivants : commercial, civil, précaire, dérogatoire, à construire, à construction ou en BEFA,Régime principal : commercial (statut des baux commerciaux art. L145-1 et suivants du Code de commerce), civil, professionnel, précaire, dérogatoire (bail 3-6-9 dérogatoire), à construire (article L251-1 du CCH), à construction, bail emphytéotique (BEFA), mixte. Chercher dans le titre du document ?",
    expectedType: "RegimeJuridique",
  },
  {
    id: "bailleur",
    query:
      "Quel est le nom du bailleur et ses coordonnées (courriel, téléphone, adresse, siret, siren) ?",
    expectedType: "Coordonnees",
  },
  {
    id: "representant_bailleur",
    query:
      "Quel est le nom du représentant du bailleur le cas échéant et ses coordonnées (capital, adresse, représentant légal) ?",
    expectedType: "RepresentantBailleur | null",
  },
  {
    id: "preneur",
    query:
      "Quel est le nom du preneur et ses coordonnées (courriel, représentant légal, adresse, siret, siren) ?",
    expectedType: "Preneur",
  },
  {
    id: "conditions_enseigne",
    query:
      "Quelles sont les conditions ou informations liées à la pose d'une enseigne ?",
    expectedType: "ConditionsEnseigne | string",
  },
  {
    id: "destination_locaux",
    query: "Quelle est la destination des locaux ?",
    expectedType: "string",
  },
  {
    id: "designation_locaux",
    query: "Quelle est la désignation des locaux ?",
    expectedType: "string",
  },
  {
    id: "adresse_locaux",
    query: "Quelle est l'adresse des locaux ?",
    expectedType: "string",
  },
  {
    id: "annee_construction",
    query: "Quelle est l'année de construction de l'immeuble ?",
    expectedType: "number | null",
  },
  {
    id: "etages_locaux",
    query: "Quels sont les étages des locaux ?",
    expectedType: "string[]",
  },
  {
    id: "numeros_lots",
    query: "Quels sont les numéros de lots ?",
    expectedType: "string[]",
  },
  {
    id: "surface_locaux",
    query:
      "Quelle est la surface des locaux, trouver la surface totale des locaux et faire le calcul de la surface de chaque local (en m²) ?",
    expectedType: "SurfaceLocaux",
  },
  {
    id: "cloisonnement",
    query:
      "Les locaux sont-ils cloisonnés ? C'est à dire, y a-t-il des cloisons entre les locaux ? Des cloisons qui séparent les locaux ? Répondre par « oui » ou « non » en précisant, vérifier si les locaux sont cloisonnés et si oui, donner le nombre de locaux cloisonnés et la surface de chaque local cloisonné (en m²) ?",
    expectedType: "Cloisonnement",
  },
  {
    id: "mobilier_equipements",
    query:
      "Les locaux sont-ils équipés avec du mobilier ? C'est à dire, y a-t-il des meubles, des équipements, des machines, etc. Répondre par « oui » ou « non » en précisant",
    expectedType: "Mobilier",
  },
  {
    id: "conditions_garnissement",
    query: "Quelles sont les conditions de garnissement des locaux ?",
    expectedType: "string",
  },
  {
    id: "conditions_pose_enseigne",
    query: "Les conditions de pose d’une enseigne sont-elles précisées ?",
    expectedType: "string",
  },

  {
    id: "local_archive",
    query:
      "L’existence d’un local d’archive ? Répondre par « oui » ou « non » en précisant.",
    expectedType: "string",
  },
]

// Type pour l'ensemble des réponses attendues
interface BailExtractionResult {
  regime_juridique: RegimeJuridique
  bailleur: Coordonnees
  representant_bailleur: RepresentantBailleur | null
  preneur: Preneur
  conditions_enseigne: ConditionsEnseigne | string
  destination_locaux: string
  designation_locaux: string
  adresse_locaux: string
  annee_construction: number | null
  etages_locaux: string[]
  numeros_lots: string[]
  surface_locaux: SurfaceLocaux
  cloisonnement: Cloisonnement
  mobilier_equipements: Mobilier
  conditions_garnissement: string
}
