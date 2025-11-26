"use client"

import { Download, CheckCircle2 } from "lucide-react"

interface DownloadResultButtonProps {
  onReset: () => void
  label?: string
}

export default function DownloadResultButton({
  onReset,
  label = "Télécharger votre résultat",
}: DownloadResultButtonProps) {
  return (
    <div className="group relative bg-white rounded-2xl border-2 border-brand-green/20 p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex flex-col items-center justify-center gap-6">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center group-hover:bg-brand-green group-hover:scale-110 transition-all duration-300">
          <CheckCircle2 className="w-10 h-10 text-brand-green group-hover:text-white transition-colors duration-300" />
        </div>

        {/* Message */}
        <div className="text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-brand-green transition-colors">
            Prêt à télécharger
          </h3>
          <p className="text-sm sm:text-base text-gray-600">
            Votre traitement est terminé
          </p>
        </div>

        {/* Download button */}
        <button
          onClick={onReset}
          className="relative inline-flex items-center gap-3 rounded-xl bg-brand-green px-8 py-4 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:bg-brand-green/90 transition-all duration-300 group-hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          <Download className="w-5 h-5" />
          <span>{label}</span>
        </button>

        {/* Reset option */}
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-brand-green transition-colors duration-200 underline-offset-4 hover:underline"
        >
          Traiter un autre fichier
        </button>
      </div>
    </div>
  )
}
