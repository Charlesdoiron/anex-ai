import { notFound, redirect } from "next/navigation"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { extractionStorage } from "@/app/lib/extraction/storage-service"
import { ExtractionPanel } from "@/app/components/extraction/extraction-panel"

interface ExtractionDetailPageProps {
  params: Promise<{
    id: string
  }>
}

async function loadExtraction(id: string): Promise<LeaseExtractionResult> {
  const extraction = await extractionStorage.getExtraction(id)
  if (!extraction) {
    notFound()
  }

  return extraction
}

export default async function ExtractionDetailPage({
  params,
}: ExtractionDetailPageProps) {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "test") {
    redirect("/")
  }

  const { id } = await params
  const extraction = await loadExtraction(id)

  return <ExtractionPanel extraction={extraction} />
}
