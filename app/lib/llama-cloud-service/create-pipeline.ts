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

    // Look for a pipeline with the specific normal name
    const pipelineName = "anex-ai-dev";
    const normalPipeline = existingPipelines.data?.find(
      (p: any) => p.name === pipelineName
    );

    if (normalPipeline) {
      console.log("✅ Reusing existing pipeline", normalPipeline.id);
      return normalPipeline.id;
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
          name: pipelineName,
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
