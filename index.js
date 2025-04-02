import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import "./config.js"
import callAgent from "./lib/agents/callAgent.js"
import { parseResponse } from "./lib/agents/helpers.js"

const app = express()
const client = new MongoClient(process.env.MONGODB_ATLAS_URI)

app.use(cors())
app.use(express.json())

async function startServer() {
  try {
    await client.connect()
    await client.db("admin").command({ ping: 1 })
    console.log("✅ Connected to MongoDB Atlas")

    app.get("/", (req, res) => {
      res.send("Pinecone server")
    })

    app.post("/chat", async (req, res) => {
      const { message } = req.body
      const threadId = Date.now().toString()

      try {
        console.log("Calling agent")
        const rawResponse = await callAgent(client, message, threadId)
        const response = await parseResponse(rawResponse)

        res.status(200).json({
          status: "success",
          message: "Message processed.",
          result: { threadId, response },
        })
      } catch (error) {
        console.error("ERROR using agent: ", error)
      }
    })

    app.post(`/chat/:threadId`, async (req, res) => {
      const { message } = req.body
      const { threadId } = req.params

      try {
        console.log("Calling agent")
        const rawResponse = await callAgent(client, message, threadId)
        const response = await parseResponse(rawResponse)

        res.status(200).json({
          status: "success",
          message: "Message processed.",
          result: { threadId, response },
        })
      } catch (error) {
        console.error("ERROR using agent: ", error)
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
