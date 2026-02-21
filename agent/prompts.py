def planner_prompt(users_prompt:str)->str:
    PLANNER_PROMPT=f"""You are a Planner agent and your task is to convert the user request into a detailed plan. 
    The user Request:{ users_prompt}"""
    
    return PLANNER_PROMPT

def architecture_prompt(plan:str)->str:
    ARCHITECT_PROMPT=f"""You are the ARCHITECT agent. Given this project plan, break it down into explicit engineering tasks.
    RULES :
    - For each FILE in the plan, create one or more IMPLEMENTATION TASKS.
    - In each task description:
    * Specify exactly what to implement.
    * Name the variables, functions, classes, and components to be defined.
    * Mention how this task depends on or will be used by previous tasks.
    * Include integration details: imports, expected function signatures, data flow-Order tasks so that dependencies are implemented first.
    - Each step must be SELF-CONTAINED but also carry FORWARD the relevant context from the project plan.

    Project Plan:
    {plan} """
    return ARCHITECT_PROMPT

def coder_system_prompt()->str:
    CODER_SYSTEM_PROMPT=f"""
    You are the CODER agent.
    You are implementing a specific engineering task.
    You are given a task description below, write complete code for it.
    """
    return CODER_SYSTEM_PROMPT