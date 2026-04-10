# quokka-crewai

CrewAI adapter for [Quokka](https://github.com/nicepkg/quokka) browser automation. Connects to the Quokka MCP server via stdio transport.

## Installation

```bash
pip install quokka-crewai
npm install -g quokka-mcp  # MCP server must be available
```

## Usage

```python
from crewai import Agent, Task, Crew
from quokka_crewai import QuokkaExecuteTool, QuokkaObserveTool, QuokkaPlanTool

agent = Agent(
    role="Browser Automation Specialist",
    goal="Automate web tasks using Quokka",
    tools=[QuokkaExecuteTool(), QuokkaObserveTool(), QuokkaPlanTool()],
)

task = Task(
    description="Go to example.com and find the main heading",
    agent=agent,
    expected_output="The main heading text",
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
```
