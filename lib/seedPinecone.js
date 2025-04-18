import "dotenv/config"
import { createReadStream } from "fs"
import csv from "csv-parser"
import axios from "axios"
import pLimit from "p-limit"
import { SingleBar, Presets } from "cli-progress"
import { buildCandidateProfile } from "./buildCandidateProfile.js"
import dotenv from "dotenv"
// import { Pinecone as PineconeClient } from "@pinecone-database/pinecone"
import { Pinecone } from "@pinecone-database/pinecone"

dotenv.config()

const BATCH_SIZE = 100
const CONCURRENCY = 10 // number of parallel embedding requests

// OpenAI Embedding with retry and exponential backoff
async function getEmbedding(text, retries = 5, delay = 1000) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { input: text, model: "text-embedding-ada-002" },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )

    return res.data.data[0].embedding
  } catch (err) {
    if (retries > 0) {
      await new Promise((res) => setTimeout(res, delay))
      return getEmbedding(text, retries - 1, delay * 2)
    } else {
      console.error("❌ Failed to embed text:", text.slice(0, 50))
      throw err
    }
  }
}

// Main upload function
async function seedPinecone() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  })
  console.log("✅ Pinecone client initialized!")

  const index = pinecone.index(process.env.PINECONE_INDEX)

  const rows = []
  createReadStream("stackoverflow_full.csv")
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      console.log(`📄 Loaded ${rows.length} records from CSV.`)

      const bar = new SingleBar({}, Presets.shades_classic)
      bar.start(rows.length, 0)

      const limit = pLimit(CONCURRENCY)

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        console.log("Embedding Data beginning @ row: ", i)

        const vectors = await Promise.all(
          batch.map((record, idx) =>
            limit(async () => {
              try {
                const text = buildCandidateProfile(record)
                const embedding = await getEmbedding(text)
                bar.increment()
                return {
                  id: `rec-${i + idx}`,
                  values: embedding,
                  metadata: {
                    country: record.Country,
                    yearsCode: record.YearsCode,
                    skills: record.HaveWorkedWith,
                    tools: record.ComputerSkills,
                    employed: record.Employment === "1",
                    education: record.EdLevel,
                    gender: record.Gender,
                    ageGroup: record.Age,
                  },
                }
              } catch (error) {
                console.error(
                  `⚠️ Failed to embed record ${i + idx}:`,
                  err.message
                )
                return null
              }
            })
          )
        )

        const validVectors = vectors.filter(Boolean)
        if (validVectors.length) {
          await index.upsert(validVectors)
        }

        try {
          //   await index.upsert({ upsertRequest: { vectors } })
          await index.upsert(vectors)
          console.log(`inserted ${BATCH_SIZE} vectors into Pinecone`)
        } catch (err) {
          console.error(
            `❌ Failed to upload batch starting at ${i}:`,
            err.message
          )
        }
      }

      bar.stop()
      console.log("✅ Upload complete!")
    })
}

seedPinecone().catch(console.error)
