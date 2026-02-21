from pydantic import BaseModel, Field, ConfigDict

class File(BaseModel):
    Path: str = Field(description="The path to the file to be created or modified.")
    Purpose: str = Field(description="The purpose of the file example:'main application','data module', 'source data', etc.")

class Plan(BaseModel):
    Name: str = Field(description="The name of the application according to the user request.")
    description: str = Field(description="The description of the app that wil be build example: A notetaking web application.")
    techstack:str = Field(description="The requried techstack needed for building that app example:'Python','java','html/css',etc.")
    features: list[str] = Field(description="A list of features that the application should have example:'user authentication', 'data visualization', etc.")
    files: list[File] = Field(description="A list of files that are required to build that app, each file should be with a 'path' and 'purpose'.")

class impletation(BaseModel):
    file_path:str =Field(description="The path of the file that needs to be modified.")
    task_description: str=Field(description="A detailed description of the task to be performed.")

class Taskplan(BaseModel):
    implementation_steps:list[impletation]=Field(description="A list of steps to be taken in a file.")
    model_config=ConfigDict(extra="allow")