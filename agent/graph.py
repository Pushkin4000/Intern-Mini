from langchain_groq import ChatGroq
from dotenv import load_dotenv
from langgraph.constants import END
from langgraph.graph import StateGraph
from langchain_core.globals import set_verbose, set_debug
from state import *
from prompts import *
from tools import *
from langchain.agents import create_agent
load_dotenv()
set_debug(True)
set_verbose(True)


llm=llm = ChatGroq(
    model="openai/gpt-oss-120b")

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
    coder_state: CoderState = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(task_plan=state["detailed_ins"], current_step_idx=0)

    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        return {"coder_state": coder_state, "status": "DONE"}

    current_task = steps[coder_state.current_step_idx]
    existing_content = read_file.run(current_task.file_path)

    system_prompt = coder_system_prompt()
    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.file_path}\n"
        f"Existing content:\n{existing_content}\n"
        "Use write_file(path, content) to save your changes."
    )

    coder_tools = [read_file, write_file, list_files, get_current_directory]
    react_agent = create_agent(llm, coder_tools)

    react_agent.invoke({"messages": [{"role": "system", "content": system_prompt},
                                     {"role": "user", "content": user_prompt}]})

    coder_state.current_step_idx += 1
    return {"coder_state": coder_state}




graph=StateGraph(dict)
graph.add_node("planner",planner_agent)
graph.add_node("architect",architect_agent)
graph.add_node("coder",coder_agent)
graph.add_edge(start_key="planner",end_key="architect")
graph.add_edge(start_key="architect",end_key="coder")
graph.add_conditional_edges(
    "coder",
    lambda s: "END" if s.get("status") == "DONE" else "coder",
    {"END": END, "coder": "coder"}
)
graph.set_entry_point("planner")
agent = graph.compile()
if __name__ == "__main__":
    result = agent.invoke({"user_prompt": " "},#Add your request here.
                          {"recursion_limit": 100})
    print("Final State:", result)