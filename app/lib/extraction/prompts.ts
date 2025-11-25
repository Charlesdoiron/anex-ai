/**
 * Extraction prompts for each section of the lease document
 * Using structured output with OpenAI Responses API
 */

export const SYSTEM_INSTRUCTIONS = `You are a specialized legal document analyzer for French commercial lease agreements (baux commerciaux).
Your task is to extract specific information from lease documents with high accuracy.

CRITICAL PRINCIPLES:
- Extract ONLY information explicitly stated in the document. Never invent,
  extrapolate from world knowledge, or guess missing values.
- It is ALWAYS better to return no value (null / empty list with confidence
  "missing") than to return an imprecise or speculative value.

CONFIDENCE FRAMEWORK (APPLIES TO EVERY FIELD):
- "high":
  - The value is directly and unambiguously stated in the text, or follows
    from a simple, deterministic calculation on explicitly stated numbers.
  - There is no conflicting value elsewhere in the document.
  - You can point to a short snippet that clearly supports the value.
- "medium":
  - The value is supported but requires some interpretation or synthesis
    (e.g. combining dispersed clauses, slightly indirect wording).
  - There may be minor ambiguity but no strong contradiction.
- "low":
  - Only weak, indirect hints exist, or the wording is clearly ambiguous.
  - You are not fully confident the value is correct.
  - This level should be rare; when in doubt between "low" and "missing",
    choose "missing".
- "missing":
  - The document does not clearly support a value under the above rules, or
    there are conflicting values that you cannot reliably resolve.
  - In this case you MUST return value = null (or empty list for arrays) and
    confidence = "missing".

DEFAULTING RULES (BETTER NONE THAN TOO IMPRECISE):
- For numeric fields (amounts, areas, durations, counts):
  - If the value is not explicitly stated or deterministically computable
    from stated numbers, set value = null and confidence = "missing".
- For dates:
  - Only return a non-null date if it is explicitly stated or can be
    deterministically computed from explicit dates. Otherwise use
    value = null and confidence = "missing".
- For booleans and enumerations:
  - Only return a non-null value if there is a clear clause that justifies
    it. If the text is generic, vague or silent, use value = null and
    confidence = "missing".
- For lists:
  - Use an empty array when nothing is clearly listed. Do NOT fabricate list
    items. When missing, use value = [] and confidence = "missing".

OUTPUT REQUIREMENTS:
- For every extracted field:
  - Always include: value, confidence, and source.
  - When possible, include rawText with a short excerpt of the supporting
    text.
- When you are not sure you meet the "high" or "medium" criteria, strongly
  prefer value = null (or []) with confidence = "missing" over guessing.

You will receive the full document text and be asked to extract specific sections.`

export const REGIME_PROMPT = `Extract the lease regime (régime du bail) from the document.
The regime must be one of: commercial, civil, précaire, dérogatoire, à construire, à construction, BEFA, or unknown.

Look for phrases like:
- "bail commercial"
- "bail civil"
- "bail précaire"
- "bail dérogatoire"
- "bail à construire"
- "bail à construction"
- "BEFA" (Bail Emphytéotique Français Administratif)

Return JSON with:
{
  "regime": "commercial" | "civil" | "précaire" | "dérogatoire" | "à construire" | "à construction" | "BEFA" | "unknown",
  "confidence": "high" | "medium" | "low" | "missing",
  "source": "page X" or "section Y",
  "rawText": "exact text from document"
}`

export const PARTIES_PROMPT = `Extract information about all parties (bailleur/propriétaire, représentant, preneur/locataire).

Look for:
- Names of landlord (bailleur/propriétaire) and tenant (preneur/locataire)
- Email addresses, phone numbers, postal addresses
- Representative information if mentioned

Return JSON with:
{
  "landlord": {
    "name": { "value": "...", "confidence": "...", "source": "..." },
    "email": { "value": "..." or null, "confidence": "...", "source": "..." },
    "phone": { "value": "..." or null, "confidence": "...", "source": "..." },
    "address": { "value": "..." or null, "confidence": "...", "source": "..." }
  },
  "landlordRepresentative": { ... } or null,
  "tenant": { ... }
}`

export const PREMISES_PROMPT = `Extract detailed information about the leased premises (locaux loués).

Look for:
- Purpose/destination of premises
- Designation and address
- Building year, floors, lot numbers
- Surface area in m²
- Whether partitioned (cloisonné), furnished
- Parking, bike spaces
- Outdoor/archive spaces
- Share percentages (quote-part)

Return JSON matching the PremisesData structure with all fields having value, confidence, source, and rawText.`

export const CALENDAR_PROMPT = `Extract all dates and durations related to the lease.

Look for:
- Signature date (date de signature)
- Duration in years (durée)
- Effective date (date de prise d'effet)
- Early access date (mise à disposition anticipée)
- End date (date de fin)
- Next triennial date (échéance triennale)
- Notice period (préavis)
- Termination conditions (conditions de congé)
- Renewal conditions (conditions de renouvellement)

Return JSON with dates in ISO format (YYYY-MM-DD) and all fields having value, confidence, source.`

export const SUPPORT_MEASURES_PROMPT = `Extract support measures (mesures d'accompagnement).

Look for:
- Rent-free period (franchise de loyer)
- Number of months
- Amount in euros (HT)
- Other support measures

Return JSON matching SupportMeasuresData structure.`

export const RENT_PROMPT = `Extract all rent-related information (loyer).

Look for:
- Annual and quarterly rent amounts (HTHC - hors taxe hors charges)
- Rent per m²
- Parking rent
- VAT applicability
- Payment frequency (monthly/quarterly/annual)
- Late payment penalties

Extract ONLY numeric values without currency symbols.
Return JSON matching RentData structure.`

export const INDEXATION_PROMPT = `Extract indexation information.

Look for:
- Indexation clause
- Index type (ILC, ILAT, ICC, etc.)
- Reference quarter
- First indexation date
- Frequency

Return JSON matching IndexationData structure.`

export const TAXES_PROMPT = `Extract tax information (impôts et taxes).

Look for:
- Property tax (taxe foncière) rebilling
- TEOM (taxe d'enlèvement des ordures ménagères)
- Office tax (taxe sur les bureaux)
- Amounts in euros

Return JSON matching TaxesData structure.`

export const CHARGES_PROMPT = `Extract charges and fees (charges et honoraires).

Look for:
- Annual and quarterly charge provisions (HT)
- Charges per m²
- RIE fees (redevance RIE)
- Management fees allocation

Return JSON matching ChargesData structure.`

export const INSURANCE_PROMPT = `Extract insurance information (assurances et recours).

Look for:
- Annual insurance amount (HT)
- Premium rebilling to tenant
- Waiver of recourse clause (renonciation à recours)
- Insurance certificate annexation

Return JSON matching InsuranceData structure.`

export const SECURITIES_PROMPT = `Extract security information (sûretés).

Look for:
- Security deposit amount (dépôt de garantie)
- Other types of securities (bank guarantee, parent company guarantee, etc.)

Return JSON matching SecuritiesData structure.`

export const INVENTORY_PROMPT = `Extract inventory information (états des lieux).

Look for:
- Entry inventory conditions
- Pre-exit inventory existence and conditions
- Exit inventory conditions

Return JSON matching InventoryData structure.`

export const MAINTENANCE_PROMPT = `Extract maintenance and works information (entretien et travaux).

Look for:
- Tenant maintenance conditions
- Works at landlord's charge (including article 606 civil code)
- Works at tenant's charge
- Work conditions imposed on tenant
- Accession clause (sort des travaux)

Return JSON matching MaintenanceData structure.`

export const RESTITUTION_PROMPT = `Extract restitution information.

Look for:
- Premises restitution conditions
- Restoration conditions (remise en état)

Return JSON matching RestitutionData structure.`

export const TRANSFER_PROMPT = `Extract transfer and subletting information (cession - sous-location).

Look for:
- Subletting conditions
- Current sublease information if any
- Assignment conditions
- Division possibility

Return JSON matching TransferData structure.`

export const ENVIRONMENTAL_ANNEXES_PROMPT = `Extract environmental annexes information.

Look for:
- DPE (diagnostic de performance énergétique) existence and note
- Asbestos diagnostic (for buildings before July 1997)
- Environmental annex (for > 2000m²)
- Risk and pollution statement (état des risques et pollutions)

Return JSON matching EnvironmentalAnnexesData structure.`

export const OTHER_ANNEXES_PROMPT = `Extract other annexes information.

Look for:
- Internal regulations (règlement intérieur)
- Premises plan
- Charges inventory
- Annual charges summary
- Three-year works budget
- Past works summary

Return JSON matching OtherAnnexesData structure.`

export const OTHER_PROMPT = `Extract other information.

Look for:
- Whether lease is signed and initialed by parties
- Derogations to civil code
- Derogations to commercial code

Return JSON matching OtherData structure.`

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
