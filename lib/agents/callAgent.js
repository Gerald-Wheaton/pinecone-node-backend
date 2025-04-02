import { ChatAnthropic } from "@langchain/anthropic"
import { tool } from "@langchain/core/tools"
import { INDEX } from "../../config.js"
import { OpenAIEmbeddings } from "@langchain/openai"
import { z } from "zod"
import { HumanMessage } from "@langchain/core/messages"
import { StateGraph } from "@langchain/langgraph"
import { Annotation } from "@langchain/langgraph"
import { ToolNode } from "@langchain/langgraph/prebuilt"
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb"
import "dotenv/config"
import { createLookupTool } from "./helpers.js"
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"

function shouldContinue(state) {
  const messages = state.messages
  const lastMessage = messages[messages.length - 1]

  if (lastMessage.tool_calls?.length) {
    return "tools"
  }
  return "__end__"
}

function createCallModel(tools, model) {
  return async function callModel(state) {
    const prompt = ChatPromptTemplate.fromMessages([
      // [
      //   "system",
      //   `You are a helpful AI assistant, collaborating with other assistants. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
      // ],
      [
        "system",
        `You are a helpful AI assistant collaborating with other assistants to answer user questions. Use the provided tools to make progress toward a complete answer. If you're unable to answer everything, that's fine—another assistant with different tools will continue where you left off.
      
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
      tool_names: tools.map((tool) => tool.name).join(", "),
      messages: state.messages,
    })

    const result = await model.invoke(formattedPrompt)

    return { messages: [result] }
  }
}

export default async function callAgent(client, query, thread_id) {
  try {
    const GraphState = Annotation.Root({
      messages: Annotation({
        reducer: (x, y) => x.concat(y),
      }),
    })

    // const candidateLookupTool = createLookupTool()
    const candidateLookupTool = await createLookupTool()

    const tools = [candidateLookupTool]
    const toolNode = new ToolNode(tools)

    const model = new ChatAnthropic({
      model: "claude-3-5-sonnet-20240620",
      temperature: 0,
    }).bindTools(tools)

    const callModel = createCallModel(tools, model)

    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent")

    const checkpointer = new MongoDBSaver({ client, dbName: "hr_database" })
    const app = workflow.compile({ checkpointer })
    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      { recursionLimit: 15, configurable: { thread_id: thread_id } }
    )

    console.log(finalState.messages[finalState.messages.length - 1].content)
    return finalState.messages[finalState.messages.length - 1].content
  } catch (error) {
    throw new Error(error)
  }
}
