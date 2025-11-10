import {
  upsertPipelineApiV1PipelinesPut,
  createPipelineApiV1PipelinesPost,
  searchPipelinesApiV1PipelinesGet,
} from "llama-cloud-services/api";

export async function createPipeline() {
  try {
    // First, try to find an existing pipeline to reuse
    const existingPipelines = await searchPipelinesApiV1PipelinesGet({
      headers: {
        Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
      },
      query: {
        project_id: process.env.LLAMA_CLOUD_PROJECT_ID,
      },
    });

    if (existingPipelines.data && existingPipelines.data.length > 0) {
      console.log("✅ Reusing existing pipeline", existingPipelines.data[0].id);
      return existingPipelines.data[0].id;
    } else {
      console.log("❌ No existing pipeline found");
      const pipeline = await createPipelineApiV1PipelinesPost({
        headers: {
          Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        },
        query: {
          project_id: process.env.LLAMA_CLOUD_PROJECT_ID,
        },
        body: {
          name: `anex-ai-dev`,
          transform_config: {},
        },
      });
      if (pipeline.error) {
        console.error("❌ Error creating pipeline", pipeline.error);
        throw new Error(
          `Failed to create pipeline: ${JSON.stringify(pipeline.error)}`
        );
      }
      console.log("✅ Pipeline created", pipeline.data?.id);
      return pipeline.data?.id;
    }
  } catch (error) {
    console.error("❌ Error creating pipeline", error);
    throw error;
  }
}
