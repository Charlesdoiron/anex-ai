import { PageLoader } from "@/app/components/ui/page-loader"

export default function ToolPageLoading() {
  return (
    <div className="min-h-screen">
      <PageLoader message="Chargement de l'outil..." fullScreen={false} />
    </div>
  )
}
