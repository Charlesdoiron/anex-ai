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
    const minTokensPerQuery = 80;
    const maxTokensPerQuery = 150;
    const baseTokensPerQuery = Math.floor(maxTokens / contextsToProcess.length);
    const tokensPerQuery = Math.max(
      minTokensPerQuery,
      Math.min(baseTokensPerQuery, maxTokensPerQuery)
    );

    console.log(
      `🔍 Processing ${contextsToProcess.length} queries with ${tokensPerQuery} tokens per query`
    );

    // Generate answers for all queries with their specific contexts
    const answers = await Promise.all(
      contextsToProcess.map(async ({ query, context: queryContext }, index) => {
        console.log(
          `🔍 Processing query ${index + 1}/${
            contextsToProcess.length
          }: ${query.substring(0, 50)}...`
        );
        console.log(`📄 Context length: ${queryContext.length} chars`);

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "Tu es un assistant d'extraction de données précises. Réponds par une phrase concise (maximum 3 lignes et 280 caractères) contenant UNIQUEMENT les informations qui répondent directement à la question. Extrais les données EXACTES et LITTÉRALES du document, sans approximation ni reformulation. Si une donnée n'est pas présente dans le contexte, réponds uniquement 'null'. Ne copie jamais l'intégralité du contexte.",
            },
            {
              role: "user",
              content: `Question: ${query}\n\nContexte du document:\n${queryContext}\n\nIMPORTANT: Extrais UNIQUEMENT les informations qui répondent directement à la question. Copie mot pour mot les données pertinentes sans les modifier, résumer ou reformuler. Ne copie pas tout le contexte, seulement ce qui est nécessaire pour répondre à la question. Limite absolument ta réponse à 280 caractères. Si la donnée exacte n'est pas présente dans le contexte, réponds uniquement 'null'.`,
            },
          ],
          temperature,
          max_tokens: tokensPerQuery,
        });

        const answer = completion.choices[0]?.message?.content || null;
        console.log(
          `✅ Answer for query ${index + 1}: ${
            answer ? answer.substring(0, 100) : "null"
          }...`
        );
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
