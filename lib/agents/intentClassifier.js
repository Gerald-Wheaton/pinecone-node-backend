import { ChatAnthropic } from "@langchain/anthropic"

export default async function intentClassifier(userMessage) {
  const classifierPrompt = `
  You are an intent classifier. The user has sent a message. Your job is to determine if the user is trying to **search for new candidates**.
  
  Respond only with "YES" or "NO".
  
  The user might use direct language like:
  - "Search for candidates skilled in React"
  - "Find me a backend engineer"
  
  Or indirect language like:
  - "Help me build a team with Supabase experience"
  - "Who should I hire for this mobile project?"
  - "I’m looking to staff a project that needs Python skills"
  - "Try again"
  - ""Send more
  
  Only respond "YES" if the user is clearly requesting new candidate suggestions. If the message is about explaining previous results or asking general advice, say "NO".
  
  User message: "${userMessage}"
  `

  const result = await new ChatAnthropic({ temperature: 0 }).invoke(
    classifierPrompt
  )
  return result.content.trim().toUpperCase() === "YES"
}
