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
    if resp is None:
        raise ValueError("The resp in none returned by the planner_agent, check pipeline.")
    return {"plan" : resp }

def architect_agent(state:dict)->dict:
    plan:Plan =state["plan"]
    resp=llm.with_structured_output(Taskplan).invoke(architecture_prompt(plan))
    if resp is None:
        raise ValueError("The architect did not return a valid response.")
    resp.plan=plan
    return {"detailed_ins":resp}

def coder_agent(state:dict)->dict:
    step=state['detailed_ins'].implementation_steps
    current_step_index=0
    current_task=step[current_step_index]

    user_prompt=(
        f"Task:{current_task.task_description}\n"
    )
    system_prompt=coder_system_prompt()
    resp=llm.invoke(system_prompt+ user_prompt)
    return {"code": resp.content}
    




graph=StateGraph(dict)
graph.add_node("planner",planner_agent)
graph.add_node("architect",architect_agent)
graph.add_node("coder",coder_agent)
graph.add_edge(start_key="planner",end_key="architect")
graph.add_edge(start_key="architect",end_key="coder")
graph.set_entry_point("planner")

agent=graph.compile()
user_prompt="Create me a flappy bird game web."

result=agent.invoke({"user_prompt":user_prompt})
print(result)