import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"
import intentClassifier from "./intentClassifier.js"

export default function createModelCaller(tools, model) {
  return async function modelCaller(state) {
    const messages = state.messages
    const lastUserMessage =
      messages[messages.length - 1]?.content?.toLowerCase() || ""

    const allowToolUse = await intentClassifier(lastUserMessage)

    const filteredTools = allowToolUse ? tools : []

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful AI assistant collaborating with other assistants to answer user questions.
          
          If the user requests to **find** or **search** for candidates, you may use tools.
          If the user is asking for **reasoning or clarification**, do not use tools—just explain based on the candidates already provided.
        
        Always do your best to:
        - If any candidates are identified in your response, extract their data into an array of JSON objects.
        - Ask the user if they would like you to explain your reasoning for these candidates.
        
        Each JSON object must follow this exact structure:
        
          id: string;            // e.g., "rec-9411"
          location: string;      // e.g., "UK"
          experienceYears: number; // e.g., 13
          skills: string[];
          matchSCore: number // the similarity score
        
        Your JSON output must be placed inside a fenced code block like this:
        
        \`\`\`json
        [
          {{
            "id": "rec-9411",
            "location": "UK",
            "experienceYears": 13,
            "skills": ["Objective-C", "Swift", "Git", "Google Cloud Platform"]
            "score": 0.93
        }},
          ...
        ]
        \`\`\`
        If you or another assistant has reached a final result, prefix your message with: FINAL ANSWER.
        
        You have access to the following tools: {tool_names}.
        {system_message}
        Current time: {time}.`,
      ],
      new MessagesPlaceholder("messages"),
    ])

    const formattedPrompt = await prompt.formatMessages({
      system_message: "You are helpful HR Chatbot Agent.",
      time: new Date().toISOString(),
      tool_names: filteredTools.map((tool) => tool.name).join(", "),
      messages: state.messages,
    })

    // const updateModel = model.bindTools(filteredTools)
    const updateModel =
      filteredTools.length > 0 ? model.bindTools?.(filteredTools) : model

    const result = await updateModel.invoke(formattedPrompt)

    return { messages: [result] }
  }
}
