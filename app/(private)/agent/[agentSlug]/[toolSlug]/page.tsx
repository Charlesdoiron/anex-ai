import UploadFileWithHistory from "@/app/components/upload-file/upload-file-wrapper/upload-file-with-history"
import { AGENTS } from "@/app/static-data/agent"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function ToolPage({
  params,
}: {
  params: Promise<{ agentSlug: string; toolSlug: string }>
}) {
  const { agentSlug, toolSlug } = await params

  const currentAgent = AGENTS.find((agent) => agent.slug === agentSlug)
  const currentTool = currentAgent?.tools.find((tool) => tool.slug === toolSlug)
  if (!currentAgent || !currentTool) {
    notFound()
  }
  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 z-10">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/"
                    className="transition-colors hover:text-gray-900"
                  >
                    Accueil
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href={`/agent/${agentSlug}`}
                    className="transition-colors hover:text-gray-900"
                  >
                    {currentAgent.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentTool.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-brand-green mb-4 sm:mb-6 tracking-tight px-2">
              {currentTool.name ?? "Outil"}
            </h1>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <UploadFileWithHistory
          label="Extraire les données du bail"
          toolType={currentTool.type}
        />
      </div>
    </div>
  )
}
