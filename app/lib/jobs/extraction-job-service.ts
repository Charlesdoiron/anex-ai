import { prisma } from "@/app/lib/prisma"
import { ExtractionService } from "@/app/lib/extraction/extraction-service"
import { RentCalculationExtractionService } from "@/app/lib/extraction/rent-calculation-service"
import type { ExtractionJobStatus } from "@prisma/client"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import type { RentCalculationResult } from "@/app/lib/extraction/rent-calculation-service"
import type { toolType } from "@/app/static-data/agent"

export interface JobProgress {
  jobId: string
  status: ExtractionJobStatus
  progress: number
  stage: string | null
  message: string | null
  documentId: string | null
  errorMessage: string | null
  toolType: toolType
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface CreateJobInput {
  fileName: string
  fileData: Buffer
  userId?: string
  toolType?: toolType
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingJobId?: string
  message?: string
}

class ExtractionJobService {
  /**
   * Check if a similar job is already in progress for this user.
   * Prevents accidental duplicate submissions (same file within 2 minutes).
   */
  async checkForDuplicate(
    fileName: string,
    fileSize: number,
    userId?: string,
    jobToolType?: toolType
  ): Promise<DuplicateCheckResult> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)

    const existingJob = await prisma.extractionJob.findFirst({
      where: {
        fileName,
        fileSize,
        userId: userId ?? null,
        toolType: jobToolType ?? "extraction-lease",
        status: { in: ["pending", "processing"] },
        createdAt: { gte: twoMinutesAgo },
      },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })

    if (existingJob) {
      return {
        isDuplicate: true,
        existingJobId: existingJob.id,
        message: `Un job identique est déjà en cours (${existingJob.status})`,
      }
    }

    return { isDuplicate: false }
  }

  async createJob(input: CreateJobInput): Promise<string> {
    const toolType = input.toolType ?? "extraction-lease"

    const job = await prisma.extractionJob.create({
      data: {
        fileName: input.fileName,
        fileSize: input.fileData.length,
        fileData: new Uint8Array(input.fileData),
        userId: input.userId ?? null,
        toolType,
        status: "pending",
        progress: 0,
        message: "Job créé, en attente de traitement",
      },
    })

    // Start processing in background (fire-and-forget)
    this.processJob(job.id).catch((err) => {
      console.error(`[Job ${job.id}] Background processing failed:`, err)
    })

    return job.id
  }

  async getJobStatus(jobId: string): Promise<JobProgress | null> {
    const job = await prisma.extractionJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        progress: true,
        stage: true,
        message: true,
        documentId: true,
        errorMessage: true,
        toolType: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    })

    if (!job) return null

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      documentId: job.documentId,
      errorMessage: job.errorMessage,
      toolType: job.toolType as toolType,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }
  }

  async getJobResult(jobId: string): Promise<LeaseExtractionResult | null> {
    const job = await prisma.extractionJob.findUnique({
      where: { id: jobId },
    })

    if (!job?.documentId) return null

    const extraction = await prisma.extraction.findUnique({
      where: { documentId: job.documentId },
    })

    if (!extraction) return null

    const { structuredData, ...meta } = extraction
    return {
      ...(structuredData as object),
      documentId: meta.documentId,
      fileName: meta.fileName,
      pageCount: meta.pageCount ?? undefined,
      extractionDate: meta.extractionDate.toISOString(),
      extractionMetadata: {
        totalFields: meta.totalFields,
        extractedFields: meta.extractedFields,
        missingFields: meta.missingFields,
        lowConfidenceFields: meta.lowConfidenceFields,
        averageConfidence: meta.averageConfidence,
        processingTimeMs: meta.processingTimeMs,
        retries: meta.retries,
      },
    } as LeaseExtractionResult
  }

  async listUserJobs(
    userId: string,
    limit = 20,
    filterToolType?: toolType
  ): Promise<JobProgress[]> {
    const jobs = await prisma.extractionJob.findMany({
      where: {
        userId,
        ...(filterToolType ? { toolType: filterToolType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        progress: true,
        stage: true,
        message: true,
        documentId: true,
        errorMessage: true,
        toolType: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    })

    return jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      documentId: job.documentId,
      errorMessage: job.errorMessage,
      toolType: job.toolType as toolType,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }))
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await prisma.extractionJob.findUnique({
      where: { id: jobId },
    })

    if (!job || job.status !== "pending") {
      return
    }

    const jobToolType = job.toolType as toolType

    try {
      await this.updateJob(jobId, {
        status: "processing",
        startedAt: new Date(),
        message: "Démarrage de l'extraction...",
      })

      if (jobToolType === "calculation-rent") {
        await this.processRentCalculationJob(jobId, job)
      } else {
        await this.processFullExtractionJob(jobId, job)
      }
    } catch (error) {
      await this.handleJobError(jobId, error)
    }
  }

  private async processFullExtractionJob(
    jobId: string,
    job: {
      fileData: Uint8Array
      fileName: string
      userId: string | null
      toolType: string
    }
  ): Promise<void> {
    const progressCallback = async (progress: {
      status: string
      message: string
      progress: number
      stage?: string
    }) => {
      await this.updateJob(jobId, {
        progress: progress.progress,
        stage: progress.stage ?? null,
        message: progress.message,
      }).catch((err) => {
        console.warn(`[Job ${jobId}] Failed to update progress:`, err)
      })
    }

    const partialResultCallback = async (
      partial: Partial<LeaseExtractionResult>
    ) => {
      await this.updateJob(jobId, {
        partialResult: partial as object,
        documentId: partial.documentId ?? null,
      }).catch((err) => {
        console.warn(`[Job ${jobId}] Failed to save partial result:`, err)
      })
    }

    const extractionService = new ExtractionService(
      progressCallback,
      partialResultCallback
    )

    const result = await extractionService.extractFromPdf(
      Buffer.from(job.fileData),
      job.fileName
    )

    await this.saveExtractionToDb(result, job.userId, job.toolType as toolType)

    await this.updateJob(jobId, {
      status: "completed",
      progress: 100,
      documentId: result.documentId,
      message: "Extraction terminée avec succès",
      completedAt: new Date(),
    })
  }

  private async processRentCalculationJob(
    jobId: string,
    job: {
      fileData: Uint8Array
      fileName: string
      userId: string | null
      toolType: string
    }
  ): Promise<void> {
    const progressCallback = async (progress: {
      status: string
      message: string
      progress: number
    }) => {
      await this.updateJob(jobId, {
        progress: progress.progress,
        message: progress.message,
      }).catch((err) => {
        console.warn(`[Job ${jobId}] Failed to update progress:`, err)
      })
    }

    const rentService = new RentCalculationExtractionService(progressCallback)

    const result = await rentService.extractAndCompute(
      Buffer.from(job.fileData),
      job.fileName
    )

    await this.saveRentCalculationToDb(result, job.userId)

    const completionMessage = result.metadata.scheduleSuccess
      ? "Calcul de loyer terminé avec succès"
      : `Extraction terminée (${result.metadata.errorMessage || "échéancier non calculé"})`

    await this.updateJob(jobId, {
      status: result.metadata.extractionSuccess ? "completed" : "failed",
      progress: 100,
      documentId: result.documentId,
      message: completionMessage,
      errorMessage: result.metadata.errorMessage ?? null,
      completedAt: new Date(),
    })
  }

  private async handleJobError(jobId: string, error: unknown): Promise<void> {
    console.error(`[Job ${jobId}] Extraction failed:`, error)

    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue"

    const updatedJob = await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        retryCount: { increment: 1 },
        errorMessage,
      },
    })

    if (updatedJob.retryCount < updatedJob.maxRetries) {
      await this.updateJob(jobId, {
        status: "pending",
        message: `Nouvelle tentative (${updatedJob.retryCount}/${updatedJob.maxRetries})...`,
      })

      setTimeout(() => {
        this.processJob(jobId).catch(console.error)
      }, 5000 * updatedJob.retryCount)
    } else {
      await this.updateJob(jobId, {
        status: "failed",
        message: "Échec après plusieurs tentatives",
        completedAt: new Date(),
      })
    }
  }

  private async updateJob(
    jobId: string,
    data: {
      status?: ExtractionJobStatus
      progress?: number
      stage?: string | null
      message?: string | null
      documentId?: string | null
      partialResult?: object
      errorMessage?: string | null
      startedAt?: Date
      completedAt?: Date
    }
  ): Promise<void> {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }

  private async saveExtractionToDb(
    result: LeaseExtractionResult,
    userId: string | null,
    extractionToolType: toolType = "extraction-lease"
  ): Promise<void> {
    const { rawText, extractionMetadata, ...structuredData } = result

    await prisma.extraction.upsert({
      where: { documentId: result.documentId },
      create: {
        documentId: result.documentId,
        userId: userId ?? null,
        fileName: result.fileName,
        fileSize: null,
        pageCount: result.pageCount ?? null,
        extractionDate: new Date(result.extractionDate),
        toolType: extractionToolType,
        structuredData: structuredData as object,
        totalFields: extractionMetadata.totalFields,
        extractedFields: extractionMetadata.extractedFields,
        missingFields: extractionMetadata.missingFields,
        lowConfidenceFields: extractionMetadata.lowConfidenceFields,
        averageConfidence: extractionMetadata.averageConfidence,
        processingTimeMs: extractionMetadata.processingTimeMs,
        retries: extractionMetadata.retries ?? 0,
      },
      update: {
        fileName: result.fileName,
        pageCount: result.pageCount ?? null,
        extractionDate: new Date(result.extractionDate),
        toolType: extractionToolType,
        structuredData: structuredData as object,
        totalFields: extractionMetadata.totalFields,
        extractedFields: extractionMetadata.extractedFields,
        missingFields: extractionMetadata.missingFields,
        lowConfidenceFields: extractionMetadata.lowConfidenceFields,
        averageConfidence: extractionMetadata.averageConfidence,
        processingTimeMs: extractionMetadata.processingTimeMs,
      },
    })

    if (rawText) {
      await prisma.rawText.upsert({
        where: { documentId: result.documentId },
        create: {
          documentId: result.documentId,
          content: rawText,
        },
        update: {
          content: rawText,
        },
      })
    }
  }

  private async saveRentCalculationToDb(
    result: RentCalculationResult,
    userId: string | null
  ): Promise<void> {
    const structuredData = {
      extractedData: result.extractedData,
      rentSchedule: result.rentSchedule,
      scheduleInput: result.scheduleInput,
    }

    const totalFields = 7 // effectiveDate, signatureDate, duration, annualRent, quarterlyRent, parkingRent, paymentFrequency
    const extractedFields = this.countExtractedFields(result.extractedData)

    await prisma.extraction.upsert({
      where: { documentId: result.documentId },
      create: {
        documentId: result.documentId,
        userId: userId ?? null,
        fileName: result.fileName,
        fileSize: null,
        pageCount: result.pageCount ?? null,
        extractionDate: new Date(result.extractionDate),
        toolType: "calculation-rent",
        structuredData: structuredData as object,
        totalFields,
        extractedFields,
        missingFields: totalFields - extractedFields,
        lowConfidenceFields: 0,
        averageConfidence: extractedFields / totalFields,
        processingTimeMs: result.metadata.processingTimeMs,
        retries: result.metadata.retries,
      },
      update: {
        fileName: result.fileName,
        pageCount: result.pageCount ?? null,
        extractionDate: new Date(result.extractionDate),
        structuredData: structuredData as object,
        totalFields,
        extractedFields,
        missingFields: totalFields - extractedFields,
        averageConfidence: extractedFields / totalFields,
        processingTimeMs: result.metadata.processingTimeMs,
      },
    })
  }

  private countExtractedFields(
    data: RentCalculationResult["extractedData"]
  ): number {
    let count = 0
    const calendar = data.calendar
    const rent = data.rent

    if (calendar.effectiveDate?.value !== null) count++
    if (calendar.signatureDate?.value !== null) count++
    if (calendar.duration?.value !== null) count++
    if (rent.annualRentExclTaxExclCharges?.value !== null) count++
    if (rent.quarterlyRentExclTaxExclCharges?.value !== null) count++
    if (rent.annualParkingRentExclCharges?.value !== null) count++
    if (rent.paymentFrequency?.value !== null) count++

    return count
  }
}

export const extractionJobService = new ExtractionJobService()
