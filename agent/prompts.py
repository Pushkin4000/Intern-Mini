def planner_prompt(users_prompt:str)->str:
    PLANNER_PROMPT=f"""You are a Planner agent and your task is to convert the user request into a detailed plan. 
    The user Request:{ users_prompt}"""
    
    return PLANNER_PROMPT
