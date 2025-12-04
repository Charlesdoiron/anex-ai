import { PromptFormWithTest } from "@/app/components/admin/prompt-form/prompt-form-with-test"
import { PageHero } from "@/app/components/ui/page-hero"

export default function LeasePage() {
  return (
    <div>
      <PageHero
        breadcrumbs={[
          { label: "Accueil", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Prompts d'extraction" },
        ]}
        title="Gestion des prompts"
        description="Modifiez et testez les prompts d'extraction des baux commerciaux"
        badge={{
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          ),
          text: "Administration",
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PromptFormWithTest />
      </div>
    </div>
  )
}
