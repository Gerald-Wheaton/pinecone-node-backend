import { ChatAnthropic } from "@langchain/anthropic"
import { HumanMessage } from "@langchain/core/messages"
import { StateGraph } from "@langchain/langgraph"
import { Annotation } from "@langchain/langgraph"
import { ToolNode } from "@langchain/langgraph/prebuilt"
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb"
import "dotenv/config"
import { createLookupTool } from "./helpers.js"
import createModelCaller from "./createModelCaller.js"

function shouldContinue(state) {
  const messages = state.messages
  const lastMessage = messages[messages.length - 1]

  if (lastMessage.tool_calls?.length) {
    return "tools"
  }
  return "__end__"
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

    // const model = new ChatAnthropic({
    //   model: "claude-3-5-sonnet-20240620",
    //   temperature: 0,
    // }).bindTools(tools)

    const model = new ChatAnthropic({
      model: "claude-3-5-sonnet-20240620",
      temperature: 0,
    })

    const modelCaller = createModelCaller(tools, model)

    const workflow = new StateGraph(GraphState)
      .addNode("agent", modelCaller)
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
