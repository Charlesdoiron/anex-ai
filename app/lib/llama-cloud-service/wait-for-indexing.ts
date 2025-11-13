import {
  listPipelineFilesApiV1PipelinesPipelineIdFilesGet,
  PipelineFile,
} from "llama-cloud-services/api";

export async function waitForPipelineFilesIndexing(
  pipelineId: string,
  maxWaitTimeMs: number = 300000,
  pollIntervalMs: number = 2000
): Promise<void> {
  const startTime = Date.now();
  let currentPollInterval = pollIntervalMs;

  while (Date.now() - startTime < maxWaitTimeMs) {
    const filesResponse =
      await listPipelineFilesApiV1PipelinesPipelineIdFilesGet({
        headers: {
          Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        },
        path: {
          pipeline_id: pipelineId,
        },
      });

    if (filesResponse.error) {
      throw new Error(
        `Failed to list pipeline files: ${JSON.stringify(filesResponse.error)}`
      );
    }

    const files = filesResponse.data as PipelineFile[];
    const allSuccess = files.every(
      (file) => file.status === "SUCCESS" && (file.indexed_page_count || 0) > 0
    );

    if (allSuccess && files.length > 0) {
      console.log("✅ All files indexed successfully");
      return;
    }

    const progressSnapshots = files.map((file) => {
      const totalPages = file.total_page_count ?? file.page_count ?? 0;
      const indexedPages = file.indexed_page_count ?? 0;
      const percentage =
        totalPages > 0
          ? `${Math.round((indexedPages / totalPages) * 100)}%`
          : indexedPages > 0
          ? "processing"
          : "pending";
      return `${file.original_file_name || file.id}: ${indexedPages}/${
        totalPages || "?"
      } pages (${percentage}) [${file.status}]`;
    });

    const hasError = files.some(
      (file) => file.status === "ERROR" || file.status === "CANCELLED"
    );

    if (hasError) {
      const errorFiles = files.filter(
        (file) => file.status === "ERROR" || file.status === "CANCELLED"
      );
      throw new Error(
        `Some files failed to index: ${JSON.stringify(
          errorFiles.map((f) => ({ id: f.id, status: f.status }))
        )}`
      );
    }

    const statusCounts = files.reduce((acc, file) => {
      acc[file.status || "UNKNOWN"] = (acc[file.status || "UNKNOWN"] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const remainingMs = maxWaitTimeMs - (Date.now() - startTime);
    const remainingSeconds = Math.max(Math.floor(remainingMs / 1000), 0);

    console.log(
      [
        `⏳ Waiting for file indexing...`,
        `status=${JSON.stringify(statusCounts)}`,
        `elapsed=${elapsedSeconds}s`,
        `remaining≈${remainingSeconds}s`,
        `progress=[${progressSnapshots.join("; ")}]`,
      ].join(" ")
    );

    await new Promise((resolve) => setTimeout(resolve, currentPollInterval));
    currentPollInterval = Math.min(currentPollInterval * 1.5, 10000);
  }

  throw new Error(
    `Pipeline file indexing timeout after ${maxWaitTimeMs}ms. Files may still be processing.`
  );
}
