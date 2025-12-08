# Anex AI - Lease Document Extraction System

An extraction system for French commercial lease agreements (baux commerciaux) powered by the OpenAI Responses API and a modern OCR stack.

## Features

- **Structured Data Extraction**: ~112 typed fields across 18 sections with confidence and source for every value
- **Streaming Progress**: Real-time extraction progress updates to the UI
- **Resilient OCR**: Mistral OCR (serverless-first), pdf-parse, Tesseract, and OpenAI Vision fallback for scanned PDFs
- **Robust Error Handling**: Automatic retries, sensible defaults for missing data
- **Confidence Scoring**: Field-level confidence (high/medium/low/missing)
- **Source Tracking**: Each extracted value references where it was read in the document

## Architecture

### Extraction Pipeline

1. **PDF Text Extraction**
   - **Serverless (default)**: Mistral OCR on the whole PDF, no native dependencies
   - **Local**: `pdf-parse` text extraction, with low-density detection
   - **OCR fallback**: Mistral OCR when available, otherwise Tesseract (native or JS), then OpenAI Vision as a last resort

2. **Structured Extraction** (OpenAI Responses API)
   - Uses `gpt-5-mini` with low reasoning effort for speed
   - 18 section prompts (regime, parties, premises, calendar, support measures, rent, indexation, taxes, charges, insurance, securities, inventory, maintenance, restitution, transfer, environmental annexes, other annexes, other)
   - JSON outputs with retries per section and sensible defaults when data is missing

3. **Progress Streaming** (Server-Sent Events)
   - Real-time status updates
   - User-friendly French messages
   - Progress percentage tracking

4. **Storage** (Filesystem)
   - JSON-based storage
   - Easy migration to database later
   - Full-text search capability
5. **Test Mode** (optionnel)
   - Active via `NEXT_PUBLIC_APP_MODE=test`
   - Force le stockage local (JSON + chunks RAG)
   - Bouton “Vider les données locales” disponible dans l’interface
   - Endpoint dédié `/api/admin/clear-data` (test uniquement)

## Extracted Data Categories

1. **Régime du bail** - Lease regime (commercial, civil, précaire, etc.)
2. **Parties** - Landlord, tenant, and representative information
3. **Description des locaux** - Premises details (surface, floors, parking, etc.)
4. **Calendrier** - Dates and durations
5. **Mesures d'accompagnement** - Support measures (rent-free periods, etc.)
6. **Loyer** - Rent amounts and payment terms
7. **Indexation** - Rent indexation clauses
8. **Impôts et taxes** - Taxes and duties
9. **Charges et honoraires** - Charges and fees
10. **Assurances** - Insurance information
11. **Sûretés** - Securities and guarantees
12. **États des lieux** - Inventory conditions
13. **Entretien et travaux** - Maintenance and works
14. **Restitution** - Restitution conditions
15. **Cession et sous-location** - Transfer and subletting
16. **Annexes environnementales** - Environmental annexes
17. **Autres annexes** - Other annexes
18. **Autres** - Other information

## API Endpoints

### POST /api/extract-lease

Extract data from a lease PDF document.

**Request:**

```bash
curl -X POST http://localhost:3000/api/extract-lease \
  -F "file=@lease.pdf" \
  -F "stream=true"
```

**Response (Streaming):**

```
data: {"status":"uploading","message":"Réception du document...","progress":0}
data: {"status":"parsing_pdf","message":"Analyse du document PDF...","progress":5}
data: {"status":"extracting_regime","message":"Extraction: Régime du bail...","progress":10}
...
data: {"status":"completed","message":"Extraction terminée","progress":100,"result":{...}}
```

**Response (Non-streaming):**

```json
{
  "success": true,
  "data": {
    "documentId": "doc_1234567890_abc123",
    "fileName": "lease.pdf",
    "extractionDate": "2025-11-19T12:00:00.000Z",
    "pageCount": 25,
    "regime": { ... },
    "parties": { ... },
    ...
    "extractionMetadata": {
      "totalFields": 150,
      "extractedFields": 120,
      "missingFields": 30,
      "lowConfidenceFields": 10,
      "averageConfidence": 0.85,
      "processingTimeMs": 45000,
      "retries": 2
    }
  }
}
```

### GET /api/extractions

List all extraction results.

### GET /api/extractions/[id]

Retrieve a specific extraction result.

### DELETE /api/extractions/[id]

Delete an extraction result.

### POST /api/admin/clear-data _(mode test uniquement)_

Efface toutes les données locales (extractions + RAG). N'est disponible qu'en mode test et nécessite une session utilisateur.

```bash
curl -X POST http://localhost:3000/api/admin/clear-data
```

Réponse :

```json
{
  "success": true,
  "summary": {
    "totalFiles": 42,
    "totalSizeBytes": 345678
  },
  "message": "Toutes les données locales ont été effacées."
}
```

## Environment Variables

```env
# OpenAI API
OPENAI_API_KEY=sk-...

# Storage
EXTRACTION_STORAGE_DIR=./storage/extractions

# Authentication (optional for development)
SKIP_AUTH=true

# Database
DATABASE_URL=postgresql://...

# INSEE Rental Index URLs (for rent calculation)
INSEE_ILAT_URL=https://www.insee.fr/fr/statistiques/serie/001617112
INSEE_ILC_URL=https://www.insee.fr/fr/statistiques/serie/001532540
INSEE_ICC_URL=https://www.insee.fr/fr/statistiques/serie/000008630

# OCR Configuration
PDF_OCR_BINARY_PATH=tesseract
PDF_OCR_LANG=fra+eng
PDF_OCR_CONCURRENCY=4
PDF_ENABLE_VISION_OCR=true
OPENAI_VISION_MODEL=gpt-5-nano
EXTRACTION_CONCURRENCY=6

# Mode applicatif
NEXT_PUBLIC_APP_MODE=prod # passer à "test" pour activer les outils locaux
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run check

# Run tests
npm test

# Format code
npm run format
```

## Testing the Extraction

```bash
# With streaming progress
curl -X POST http://localhost:3000/api/extract-lease \
  -F "file=@test-lease.pdf" \
  -F "stream=true"

# Without streaming
curl -X POST http://localhost:3000/api/extract-lease \
  -F "file=@test-lease.pdf"
```

## Technology Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **OpenAI GPT-5** - Structured extraction
- **pdf-parse** - PDF text extraction
- **Tesseract OCR** - Local OCR engine
- **Prisma** - Database ORM (optional)
- **Better Auth** - Authentication

## Project Structure

```
app/
├── api/
│   ├── extract-lease/        # Main extraction endpoint
│   └── extractions/           # CRUD endpoints for results
├── lib/
│   ├── extraction/
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── prompts.ts         # Extraction prompts
│   │   ├── pdf-extractor.ts   # PDF text extraction
│   │   ├── extraction-service.ts  # Main extraction logic
│   │   └── storage-service.ts     # Result storage
│   └── auth.ts
└── components/
    └── chat/                  # UI components
```

## Future Enhancements

- [ ] Computed scores and metrics based on extracted data
- [ ] Multi-language support
- [ ] Database persistence (Prisma integration)
- [ ] Document comparison
- [ ] Batch processing
- [ ] Export to Excel/Word
- [ ] Custom extraction templates
- [x] OCR for scanned documents

## Notes

- Uses minimal reasoning effort for faster extraction
- Automatic retries (up to 3 attempts) for failed sections
- Fallback values for missing data
- All dates in ISO format (YYYY-MM-DD)
- Amounts without currency symbols (numeric only)
- Source tracking for audit trails

## License

Private - All rights reserved
