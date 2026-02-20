from langchain_groq import ChatGroq
from dotenv import load_dotenv
from langgraph.constants import END
from langgraph.graph import StateGraph
from state import *
from prompts import *
load_dotenv()



llm=ChatGroq(model="openai/gpt-oss-120b")\

def planner_agent(state: dict) -> dict:
    users_prompt = state["user_prompt"]
    resp=llm.with_structured_output(Plan).invoke(planner_prompt(users_prompt))
    return {"plan" : resp }



graph=StateGraph(dict)
graph.add_node("planner",planner_agent)
graph.set_entry_point("planner")

agent=graph.compile()
user_prompt="Create me a c complier"

result=agent.invoke({"user_prompt":user_prompt})
print(result)