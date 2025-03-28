import dotenv from "dotenv"
import express from "express"
import cors from "cors"
import { Pinecone } from "@pinecone-database/pinecone"

dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })

const indexName = "candidate-match"

async function startServer() {
  try {
    app.get("/", (req, res) => {
      res.send("Pinecone server")
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
