import {
  listPipelineFilesApiV1PipelinesPipelineIdFilesGet,
  PipelineFile,
} from "llama-cloud-services/api";

export async function waitForPipelineFilesIndexing(
  pipelineId: string,
  maxWaitTimeMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<{ pageCount: number }> {
  const startTime = Date.now();

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
      const totalPages = files.reduce(
        (sum, file) => sum + (file.indexed_page_count || 0),
        0
      );
      console.log(`✅ All files indexed successfully (${totalPages} pages)`);
      return { pageCount: totalPages };
    }

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

    console.log(
      `⏳ Waiting for file indexing... Status: ${JSON.stringify(statusCounts)}`
    );
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Pipeline file indexing timeout after ${maxWaitTimeMs}ms. Files may still be processing.`
  );
}
