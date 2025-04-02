import { tool } from "@langchain/core/tools"
import { INDEX } from "../../config.js"
import { OpenAIEmbeddings } from "@langchain/openai"
import { z } from "zod"
import "../../config.js"

export async function createLookupTool() {
  return tool(
    async ({ query, n = 10 }) => {
      try {
        const embeddings = new OpenAIEmbeddings({
          apiKey: process.env.OPENAI_API_KEY,
        })

        const queryVector = await embeddings.embedQuery(query)
        const result = await INDEX.query({
          vector: queryVector,
          topK: n,
          includeMetadata: true,
        })

        return JSON.stringify(result.matches)
      } catch (error) {
        console.error("Error in createLookupTool:", error)
        return "Error: Unable to perform candidate lookup at the moment."
      }
    },
    {
      name: "candidate_lookup",
      description: "Gathers candidate details from the database using Pinecone",
      schema: z.object({
        query: z.string().describe("The search query"),
        n: z
          .number()
          .optional()
          .default(10)
          .describe("Number of results to return"),
      }),
    }
  )
}

export async function parseResponse(rawResponse) {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/
  const match = rawResponse.match(jsonRegex)

  let candidates = []
  let message = rawResponse

  if (match) {
    try {
      candidates = JSON.parse(match[1])
      message = rawResponse.replace(match[0], "").trim()
    } catch (err) {
      console.warn("Failed to parse JSON from response:", err)
    }
  }

  message = message.replace(/\n{2,}/g, "\n\n")

  return { message, candidates }
}
