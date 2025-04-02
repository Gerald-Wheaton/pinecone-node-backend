import "../config.js"
import { Pinecone } from "@pinecone-database/pinecone"

const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const model = "multilingual-e5-large"

export async function generateQueryEmbedding(query) {
  try {
    return await client.inference.embed(model, {
      input: query,
      params: { inputType: "query", truncate: "END" },
    })
  } catch (error) {
    console.error("Error generating embeddings ", error)
  }
}
