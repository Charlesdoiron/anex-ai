import {
  addFilesToPipelineApiApiV1PipelinesPipelineIdFilesPut,
  uploadFileApiV1FilesPost,
} from "llama-cloud-services/api";

export async function addFileToPipeline(pdfFile: File, pipelineId: string) {
  try {
    if (!pipelineId) {
      throw new Error("Pipeline ID is required");
    }

    console.log("🔍 Adding file to pipeline", pipelineId);

    // Use original filename with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const originalName = pdfFile.name.replace(/\.pdf$/i, "");
    const uniqueFileName = `${originalName}_${timestamp}.pdf`;

    // Create a new File object with the unique name
    const fileBlob = new File([pdfFile], uniqueFileName, {
      type: pdfFile.type,
    });
    console.log("🔍 Uploading file to pipeline:", uniqueFileName);

    const file = await uploadFileApiV1FilesPost({
      headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
      query: { project_id: process.env.LLAMA_CLOUD_PROJECT_ID },
      body: { upload_file: fileBlob },
    });

    if (file.error) {
      console.error("❌ File upload error:", file.error);
      throw new Error(`Failed to upload file: ${JSON.stringify(file.error)}`);
    }

    if (!file.data?.id) {
      console.error(
        "❌ File upload response missing ID:",
        JSON.stringify(file, null, 2)
      );
      throw new Error("File uploaded but response missing ID");
    }

    const response =
      await addFilesToPipelineApiApiV1PipelinesPipelineIdFilesPut({
        headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
        path: { pipeline_id: pipelineId },
        body: [
          {
            file_id: file.data.id,
            custom_metadata: { document_type: "PDF" },
          },
        ],
      });

    if (response.error) {
      console.error("❌ Add file to pipeline error:", response.error);
      throw new Error(
        `Failed to add file to pipeline: ${JSON.stringify(response.error)}`
      );
    }

    console.log("✅ File added to pipeline", response.data.id);
    return {
      ...response.data,
      file_id: file.data.id, // Return the file_id for filtering queries
    };
  } catch (error) {
    console.error("❌ Error adding file to pipeline", error);
    throw error;
  }
}
