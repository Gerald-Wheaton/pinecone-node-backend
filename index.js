import dotenv from "dotenv"
import express from "express"
import cors from "cors"
import { Pinecone } from "@pinecone-database/pinecone"
import { generateQueryEmbedding } from "./search/generate-query-embedding.js"

dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })

async function startServer() {
  try {
    app.get("/", (req, res) => {
      res.send("Pinecone server")
    })

    app.post("/chat", (req, res) => {
      const { message } = req.body.message
      console.log(`THE MESSAGE FROM NEXTJS: ${message}`)

      try {
        const embededQuery = generateQueryEmbedding(message)

        const queryResponse = pinecone.index("candidate-match").query({
          vector: embededQuery[0],
          topK: 10,
          includeMetadata: true,
        })

        res
          .status(200)
          .send(
            `NextJS asked: ${message}\n\nPinecone responded with:\n${queryResponse}`
          )
      } catch (error) {
        console.error("ERROR GETTING THE QUERY EMBEDDING")
      }
    })

    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error(error)
  }
}

startServer().catch(console.error())
