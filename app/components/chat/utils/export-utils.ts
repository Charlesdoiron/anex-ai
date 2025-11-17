import jsPDF from "jspdf"
import { MessageWithSources } from "../types"

/**
 * Track export in database
 */
async function trackExport(format: "pdf" | "csv", messageCount: number) {
  try {
    await fetch("/api/track-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ format, messageCount }),
    })
  } catch (error) {
    console.error("Failed to track export:", error)
    // Don't fail the export if tracking fails
  }
}

/**
 * Export all assistant messages to PDF
 */
export async function exportAllToPDF(messages: MessageWithSources[]) {
  try {
    const assistantMessages = messages.filter((m) => m.role === "assistant")

    if (assistantMessages.length === 0) {
      alert("Aucune réponse à exporter")
      return
    }

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const maxWidth = pageWidth - 2 * margin

    // Add title
    pdf.setFontSize(16)
    pdf.text("Anex AI - Export", margin, margin)

    // Add date
    pdf.setFontSize(10)
    const date = new Date().toLocaleString("fr-FR")
    pdf.text(date, margin, margin + 7)

    let yPosition = margin + 15

    // Add each assistant message
    assistantMessages.forEach((message, index) => {
      // Add separator between messages
      if (index > 0) {
        yPosition += 5
        if (yPosition > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
        pdf.setDrawColor(200)
        pdf.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 5
      }

      // Add message content
      pdf.setFontSize(11)
      const cleanContent = message.content.replace(/[*#_]/g, "") // Remove markdown formatting
      const lines = pdf.splitTextToSize(cleanContent, maxWidth)

      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
        pdf.text(line, margin, yPosition)
        yPosition += 6
      }
    })

    // Save the PDF
    const filename = `anex-export-${Date.now()}.pdf`
    pdf.save(filename)

    // Track export
    await trackExport("pdf", assistantMessages.length)
  } catch (error) {
    console.error("Error exporting to PDF:", error)
    alert("Erreur lors de l'export PDF")
  }
}

/**
 * Parse markdown table or structured content to CSV
 */
function parseContentToCSV(content: string): string[][] {
  const rows: string[][] = []

  // Try to extract tables from markdown
  const tableRegex = /\|(.+)\|/g
  const tableLines = content.match(tableRegex)

  if (tableLines && tableLines.length > 0) {
    // Remove markdown table formatting and convert to CSV
    tableLines
      .filter((line) => !line.includes("---")) // Remove separator lines
      .forEach((line) => {
        const cells = line
          .split("|")
          .filter((cell) => cell.trim())
          .map((cell) => cell.trim())
        rows.push(cells)
      })
    return rows
  }

  // If no table found, try to parse structured data
  const lines = content.split("\n").filter((line) => line.trim())

  // Look for key-value pairs (e.g., "Key: Value")
  const kvPairs = lines.filter((line) => line.includes(":"))

  if (kvPairs.length > 0) {
    kvPairs.forEach((line) => {
      const colonIndex = line.indexOf(":")
      const key = line
        .substring(0, colonIndex)
        .trim()
        .replace(/[*#-]/g, "")
        .trim()
      const value = line.substring(colonIndex + 1).trim()
      rows.push([key, value])
    })
    return rows
  }

  // Fallback: export as single column
  lines.forEach((line) => {
    rows.push([line])
  })

  return rows
}

/**
 * Export all assistant messages to CSV
 */
export async function exportAllToCSV(messages: MessageWithSources[]) {
  try {
    const assistantMessages = messages.filter((m) => m.role === "assistant")

    if (assistantMessages.length === 0) {
      alert("Aucune réponse à exporter")
      return
    }

    const allRows: string[][] = []
    let hasHeader = false

    // Combine all messages
    assistantMessages.forEach((message) => {
      const messageRows = parseContentToCSV(message.content)

      // Add header only once if it exists
      if (messageRows.length > 0) {
        const firstRow = messageRows[0]

        // Check if first row is a header (contains "Champ" or similar header terms)
        if (
          !hasHeader &&
          firstRow.length === 2 &&
          (firstRow[0].toLowerCase().includes("champ") ||
            firstRow[0].toLowerCase().includes("field") ||
            firstRow[0].toLowerCase().includes("question"))
        ) {
          allRows.push(firstRow)
          hasHeader = true
          // Add the rest of the rows without the header
          allRows.push(...messageRows.slice(1))
        } else {
          // If no header yet and this doesn't look like a header row, add a default header
          if (!hasHeader && allRows.length === 0) {
            allRows.push(["Champ", "Valeur"])
            hasHeader = true
          }
          allRows.push(...messageRows)
        }
      }
    })

    // If no header was added, add it now
    if (!hasHeader && allRows.length > 0) {
      allRows.unshift(["Champ", "Valeur"])
    }

    // Convert to CSV string
    const csvContent = allRows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n")

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    })

    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `anex-export-${Date.now()}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    // Track export
    await trackExport("csv", assistantMessages.length)
  } catch (error) {
    console.error("Error exporting to CSV:", error)
    alert("Erreur lors de l'export CSV")
  }
}
