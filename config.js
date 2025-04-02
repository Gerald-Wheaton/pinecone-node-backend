import dotenv from "dotenv"
import { Pinecone } from "@pinecone-database/pinecone"

dotenv.config()

const PINECONE = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const INDEX = PINECONE.index("candidate-match")

export { PINECONE, INDEX }
