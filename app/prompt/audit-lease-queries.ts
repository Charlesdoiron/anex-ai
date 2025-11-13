export interface AuditLeaseSections {
  leaseRegime: string[];
  parties: string[];
  premises: string[];
  timeline: string[];
  incentives: string[];
  rents: string[];
  indexation: string[];
  taxes: string[];
  chargesAndFees: string[];
  insurance: string[];
  security: string[];
  inspections: string[];
  works: string[];
  handover: string[];
  assignment: string[];
  environmentalAnnexes: string[];
  additionalAnnexes: string[];
  miscellaneous: string[];
}

export const auditLeaseQueries: AuditLeaseSections = {
  leaseRegime: [
    "Quel est le régime juridique du bail parmi les suivants : commercial, civil, précaire, dérogatoire, à construire, à construction ou en BEFA ?",
  ],
  parties: [
    "Quel est le nom du bailleur/propriétaire et ses coordonnées (courriel, téléphone, adresse, SIRET) ?",
    "Quel est le nom du représentant du bailleur/propriétaire le cas échéant et ses coordonnées (courriel, téléphone, adresse, représentant légal) ?",
    "Quel est le nom du preneur/locataire et ses coordonnées (courriel, téléphone, adresse, SIRET) ?",
  ],
  premises: [
    "Quelle est la destination des locaux ?",
    "Quelle est la désignation des locaux ?",
    "Quelle est l'adresse des locaux ?",
    "Quelle est l'année de construction de l'immeuble ?",
    "Quels sont les étages des locaux ?",
    "Quels sont les numéros de lots ?",
    "Quelle est la surface des locaux (en m²) ?",
    "Les locaux sont-ils cloisonnés ? Répondre par « oui » ou « non » en précisant",
    "Les locaux sont-ils équipés avec du mobilier ? Répondre par « oui » ou « non » en précisant",
    "Quelles sont les conditions de garnissement des locaux ?",
    "Quelles sont les conditions de pose d'une enseigne ?",
    "Existe-t-il un espace extérieur ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il un local d'archive ? Répondre par « oui » ou « non » en précisant",
    "Quel est le nombre d'emplacements parkings inclus dans le bail ?",
    "Quel est le nombre d'emplacements deux-roues inclus dans le bail ?",
    "Quel est le nombre d'emplacements vélos inclus dans le bail ?",
    "Quelle est la quote-part de l'immeuble loué incluant les parties communes ?",
    "Quelle est la quote-part de l'immeuble loué hors partie commune ?",
    "Quelle est la quote-part de l'immeuble complet ?",
  ],
  timeline: [
    "Quelle est la date de signature du bail ?",
    "Quelle est la durée du bail en année ?",
    "Quelle est la date de prise d'effet du bail ?",
    "Quelle est la date de mise à disposition anticipée des locaux s'il y en a une ?",
    "Quelle est la date de fin de bail ?",
    "Quelle est la date de la prochaine échéance triennale du bail (tous les 3 ans à partir de la date de signature) ?",
    "Quelle est la durée de préavis ?",
    "Quelles sont les conditions pour donner congé ?",
    "Quelles sont les conditions de renouvellement à l'échéance du bail ?",
  ],
  incentives: [
    "Y a-t-il une franchise de loyer ? Répondre par « oui » ou « non » en précisant",
    "Quel est le nombre de mois de franchise de loyer le cas échéant ?",
    "Quel est le montant hors taxe (HT) de la franchise de loyer ?",
    "Y a-t-il une autre mesure d'accompagnement ? Si oui, la préciser et l'expliquer",
  ],
  rents: [
    "Quel est le montant du loyer annuel hors taxe hors charges (HTHC) ?",
    "Quel est le montant du loyer trimestriel hors taxe hors charges (HTHC) ?",
    "Quel est le montant du loyer annuel au m² hors taxe hors charges (HTHC) ?",
    "Quel est le montant du loyer annuel des emplacements parkings hors taxe hors charges (HTHC) ?",
    "Quel est le montant du loyer trimestriel des emplacements parkings hors taxe hors charges (HTHC) ?",
    "Quel est le montant du loyer annuel des emplacements parkings par unité hors taxe hors charges (HTHC) ?",
    "Le loyer est-il soumis à la TVA ? Répondre par « oui » ou « non » en précisant",
    "Quelles sont les modalités de règlement du loyer et la périodicité de facturation (mensuelle, trimestrielle) ?",
    "Quelles sont les conditions d'application des pénalités pour retard de paiement des loyers ?",
    "Quel est le montant des pénalités pour retard de paiement des loyers ?",
  ],
  indexation: [
    "Quel est l'indice d'indexation des loyers (IRL, ICC, ILC, ILAT) ?",
    "Quel est le trimestre de référence de l'indice d'indexation des loyers ?",
    "Quelle est la date de la première indexation ?",
    "Quelle est la cadence d'indexation ?",
  ],
  taxes: [
    "La taxe foncière et la TEOM sont-elles refacturées au preneur ? Répondre par « oui » ou « non » en précisant",
    "Quel est le montant annuel de la taxe foncière et de la TEOM refacturé au preneur le cas échéant ?",
    "Quel est le montant annuel de la taxe sur les bureaux et locaux commerciaux et de stockages ?",
  ],
  chargesAndFees: [
    "Quel est le montant annuel hors taxe (HT) des provisions pour charges ?",
    "Quel est le montant trimestriel hors taxe (HT) des provisions pour charges ?",
    "Quel est le montant annuel hors taxe (HT) des provisions pour charges au m² ?",
    "Quel est le montant annuel de la redevance RIE hors taxe (HT) ?",
    "Quel est le montant trimestriel de la redevance RIE hors taxe (HT) ?",
    "Quel est le montant annuel de la redevance RIE au m² hors taxe (HT) ?",
    "Les honoraires de gestion locative et technique sont-ils à la charge du preneur ? Répondre par « oui » ou « non » en précisant",
    "Les honoraires de gestion des loyers sont-ils à la charge du preneur ? Répondre par « oui » ou « non » en précisant",
  ],
  insurance: [
    "Quel est le montant annuel hors taxe (HT) de l'assurance ?",
    "Les primes d'assurance sont-elles refacturées au preneur ? Répondre par « oui » ou « non » en précisant",
    "Y a-t-il une clause de renonciation réciproque à recours ? Répondre par « oui » ou « non » en précisant",
    "L'attestation d'assurance est-elle annexée au bail ? Répondre par « oui » ou « non » en précisant",
  ],
  security: [
    "Quel est le montant du dépôt de garantie ?",
    "Quels sont les autres types de sûretés présents s'il y en a ?",
  ],
  inspections: [
    "Quelles sont les conditions de l'état des lieux d'entrée ?",
    "Existe-t-il un pré-état des lieux de sortie ? Répondre par « oui » ou « non » en précisant",
    "Quelles sont les conditions du pré-état des lieux de sortie ?",
    "Quelles sont les conditions de l'état des lieux de sortie ?",
  ],
  works: [
    "Quelles sont les conditions d'entretien et de maintenance par le preneur ?",
    "Quelle est la liste des travaux à la charge du bailleur (dont article 606 du code civil) ?",
    "Quelle est la liste des travaux à la charge du preneur ?",
    "Quelles sont les conditions de travaux imposées au preneur ?",
    "Quel est le sort des travaux effectués par le preneur en fin de bail : existe-t-il une clause d'accession ? Répondre par « oui » ou « non » en précisant",
  ],
  handover: [
    "Quelles sont les conditions de restitution des locaux ?",
    "Quelles sont les conditions de remise en état des locaux ?",
  ],
  assignment: [
    "Quelles sont les conditions de sous-location ?",
    "Quelles sont les conditions de cession du bail ?",
    "La division des locaux est-elle possible ? Répondre par « oui » ou « non » en précisant",
  ],
  environmentalAnnexes: [
    "Existe-t-il un diagnostic de performance énergétique (DPE) ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il la note DPE ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il le diagnostic amiante (obligatoire pour immeuble construit avant 1er juillet 1997) ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il une annexe environnementale si plus de 2 000 m² ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il l'état des risques et pollutions (obligatoire depuis 2006 et daté de moins de 6 mois) ? Répondre par « oui » ou « non » en précisant",
  ],
  additionalAnnexes: [
    "Existe-t-il un règlement intérieur ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il un plan des locaux ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il un inventaire précis et limitatif des catégories de charges, impôts, taxes et redevances liés au bail ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il un état récapitulatif annuel des catégories de charges, impôts, taxes et redevance ? Répondre par « oui » ou « non » en précisant",
    "Existe-t-il un état et budget prévisionnels des travaux dans les trois prochaines années ? Répondre par « oui » ou « non ». Si oui, indiquer le montant annuel",
    "Existe-t-il un état récapitulatif et coûts des travaux passés ? Répondre par « oui » ou « non » en précisant",
  ],
  miscellaneous: [
    "Le bail est-il signé et paraphé par les parties ? Répondre par « oui » ou « non » en précisant",
    "Quelle est la liste des dérogations au code civil, dont les articles 1722, 1723 et 1724 ?",
    "Quelle est la liste des dérogations au code du commerce ?",
  ],
};
