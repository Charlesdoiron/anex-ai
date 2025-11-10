# Anex AI - PDF Document Extraction System

A Next.js application that extracts structured data from PDF documents (specifically lease agreements) using LlamaIndex Cloud for document indexing and OpenAI GPT-4o for intelligent data extraction.

## What This Application Does

This application processes PDF documents through the following workflow:

1. **PDF Upload**: Users upload a PDF file through the web interface
2. **Document Indexing**: The PDF is uploaded to LlamaIndex Cloud, which:
   - Extracts text and structure from the PDF
   - Creates a searchable index of the document content
   - Waits for indexing to complete (up to 2 minutes)
3. **Query Processing**: The system runs 17 predefined queries against the indexed document (see [`app/prompt/`](app/prompt/)):
   - Lessor information (name, contact details, SIRET)
   - Lessor representative information
   - Lessee information
   - Signage conditions
   - Premises details (address, designation, destination)
   - Building information (construction year, floors, lot numbers)
   - Premises specifications (surface area, partitioning, furniture)
   - Furnishing conditions
4. **Intelligent Extraction**: For each query:
   - Retrieves relevant document chunks using hybrid search (dense + sparse similarity)
   - Applies reranking to find the most relevant passages
   - Deduplicates and filters results by relevance score (min 0.5)
   - Generates precise answers using OpenAI GPT-4o with strict extraction instructions
5. **Results Display**: Shows Q&A pairs with:
   - Source citations (page numbers, file names)
   - Relevance scores
   - Clickable source references

## Architecture

### Frontend (`app/components/chat.tsx`)

- React chat interface built with Vercel AI SDK
- Handles PDF file uploads
- Displays extraction results with source citations
- Supports data re-extraction from uploaded documents

### API Routes

#### `/api/extract-pdf` (POST)

Main extraction endpoint that:

- Creates or reuses a LlamaIndex Cloud pipeline
- Uploads the PDF file to the pipeline
- Waits for indexing completion
- Executes all 15 predefined queries in parallel
- Processes retrieval results with deduplication and relevance filtering
- Generates answers using OpenAI
- Returns structured results with sources

### Library Functions

#### LlamaIndex Cloud Integration (`app/lib/llama-index/llama-cloud-service/`)

- `create-pipeline.ts`: Creates or reuses a document processing pipeline
- `add-file-to-pipeline.ts`: Uploads PDF files to the pipeline
- `query-pipeline.ts`: Queries the indexed document with hybrid search
- `wait-for-indexing.ts`: Polls pipeline status until indexing completes

#### Data Processing (`app/lib/llama-index/`)

- `extract-text-from-nodes.ts`:
  - Extracts source information (page numbers, file names, scores)
  - Deduplicates retrieval nodes by text content
  - Sorts nodes by relevance score
  - Truncates context based on relevance and max length
- `generate-answer.ts`: Uses OpenAI GPT-4o to extract precise answers from document context
- `format-extraction-response.ts`: Formats the final response with sources and metadata

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI/ML**:
  - LlamaIndex Cloud Services (document indexing and retrieval)
  - OpenAI GPT-4o (answer generation)
- **UI Libraries**:
  - Vercel AI SDK (`@ai-sdk/react`) for chat interface
  - React Markdown for rendering formatted text

## Environment Variables

Required environment variables:

```env
OPENAI_API_KEY=your_openai_api_key
LLAMA_CLOUD_API_KEY=your_llama_cloud_api_key
LLAMA_CLOUD_PROJECT_ID=your_llama_cloud_project_id
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` file with required environment variables

3. Run development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
├── api/
│   └── extract-pdf/
│       └── route.ts              # PDF extraction API endpoint
├── components/
│   └── chat.tsx                  # Main chat UI component
├── lib/
│   └── llama-index/
│       ├── extract-text-from-nodes.ts    # Node processing utilities
│       ├── format-extraction-response.ts  # Response formatting
│       ├── generate-answer.ts            # OpenAI answer generation
│       └── llama-cloud-service/
│           ├── create-pipeline.ts        # Pipeline management
│           ├── add-file-to-pipeline.ts   # File upload
│           ├── query-pipeline.ts         # Document querying
│           └── wait-for-indexing.ts      # Indexing status polling
├── globals.css                   # Global styles
├── layout.tsx                    # Root layout
├── page.tsx                      # Home page (renders Chat component)
├── prompt/                       # Extraction prompts
│   └── Prompts audit bail et calcul.docx
└── mocks/                        # Mock PDF documents for testing
    ├── full-document.pdf
    └── light-document.pdf
```

## Key Features

### Hybrid Search

Uses both dense and sparse similarity search with reranking for optimal retrieval:

- Dense similarity: Semantic understanding
- Sparse similarity: Keyword matching
- Reranking: Refines top results

### Relevance Filtering

- Filters nodes by minimum relevance score (0.5)
- Falls back to top 3 nodes if none meet threshold
- Truncates context to 4000 characters per query

### Source Tracking

- Tracks page numbers, file names, and character positions
- Displays source citations with relevance scores
- Enables traceability of extracted information

### Error Handling

- Pipeline creation failures
- File upload errors
- Indexing timeouts (2 minutes max)
- Answer generation fallbacks

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Notes

- The application is optimized for French lease agreement documents
- Maximum extraction time is 5 minutes (300 seconds) per request
- Uses GPT-4o model with temperature 0 for consistent, precise extraction
- Pipeline reuse reduces API calls and costs
