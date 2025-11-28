import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { computeRentScheduleFromExtraction } from "@/app/lib/lease/from-extraction"
import { extractionStorage } from "@/app/lib/extraction/storage-service"

export async function POST(request: NextRequest) {
  try {
    const skipAuth = process.env.SKIP_AUTH === "true"

    if (!skipAuth) {
      try {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session?.user?.id) {
          return NextResponse.json(
            { error: "Unauthorized", message: "Authentication required" },
            { status: 401 }
          )
        }
      } catch (authError) {
        console.error("Auth error:", authError)
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication failed" },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const { extractionId } = body

    if (!extractionId || typeof extractionId !== "string") {
      return NextResponse.json(
        { error: "extractionId is required" },
        { status: 400 }
      )
    }

    const extraction = await extractionStorage.getExtraction(extractionId)

    if (!extraction) {
      return NextResponse.json(
        { error: "Extraction non trouvée" },
        { status: 404 }
      )
    }

    const schedule = await computeRentScheduleFromExtraction(extraction)

    if (!schedule) {
      return NextResponse.json(
        {
          error:
            "Données insuffisantes pour calculer l'échéancier. Vérifiez le loyer, la fréquence de paiement et les dates.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error("Error computing rent schedule:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du calcul de l'échéancier",
      },
      { status: 500 }
    )
  }
}
