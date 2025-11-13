import OpenAI from "openai";

interface QueryContext {
  query: string;
  context: string;
}

interface GenerateAnswerOptions {
  // New format: query-specific contexts
  queryContexts?: QueryContext[];
  // Legacy format: for backward compatibility
  queries?: string[];
  context?: string;
  maxContextLength?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AnswerWithQuery {
  query: string;
  answer: string | null;
  index: number;
}

export async function generateAnswerFromContext(
  options: GenerateAnswerOptions
): Promise<AnswerWithQuery[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const {
      queryContexts,
      queries,
      context,
      maxContextLength = 12000,
      model = "gpt-4o",
      temperature = 0,
      maxTokens = 1000,
    } = options;

    // Determine which format to use
    let contextsToProcess: QueryContext[];

    if (queryContexts && queryContexts.length > 0) {
      // New format: use query-specific contexts
      contextsToProcess = queryContexts;
    } else if (queries && context) {
      // Legacy format: create contexts from queries and shared context
      contextsToProcess = queries.map((query) => ({
        query,
        context: context.substring(0, maxContextLength),
      }));
    } else {
      console.error(
        "❌ Invalid options: need either queryContexts or (queries + context)"
      );
      return null;
    }

    // Calculate maxTokens per query based on total queries
    const tokensPerQuery = Math.max(
      500,
      Math.floor(maxTokens / contextsToProcess.length)
    );

    // Generate answers for all queries with their specific contexts
    const answers = await Promise.all(
      contextsToProcess.map(async ({ query, context: queryContext }, index) => {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "Tu es un assistant d'extraction de données précises. Ton rôle est d'extraire UNIQUEMENT les informations qui répondent directement à la question posée. Extrais les données EXACTES et LITTÉRALES du document, sans approximation, résumé ou interprétation. Si une donnée n'est pas présente dans le contexte, réponds uniquement 'null'. Ne copie pas tout le contexte, seulement les informations pertinentes à la question.",
            },
            {
              role: "user",
              content: `Question: ${query}\n\nContexte du document:\n${queryContext}\n\nIMPORTANT: Extrais UNIQUEMENT les informations qui répondent directement à la question. Copie mot pour mot les données pertinentes sans les modifier, résumer ou reformuler. Ne copie pas tout le contexte, seulement ce qui est nécessaire pour répondre à la question. Si la donnée exacte n'est pas présente dans le contexte, réponds uniquement 'null'.`,
            },
          ],
          temperature,
          max_tokens: tokensPerQuery,
        });

        const answer = completion.choices[0]?.message?.content || null;

        return { query, answer, index };
      })
    );

    // Return structured answers instead of combined string
    return answers;
  } catch (error) {
    console.error("❌ Error generating answer with OpenAI:", error);
    return null;
  }
}
