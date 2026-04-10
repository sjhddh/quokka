"""Quokka browser automation tools for CrewAI.

Each tool connects to the Quokka MCP server via subprocess stdio transport
and delegates to the corresponding MCP tool (quokka_execute, quokka_observe,
quokka_plan).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional, Type

from crewai.tools import BaseTool
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# MCP connection helper
# ---------------------------------------------------------------------------

_DEFAULT_SERVER_PARAMS = StdioServerParameters(
    command="npx",
    args=["quokka-mcp"],
)


async def _call_mcp_tool(
    tool_name: str,
    arguments: dict[str, Any],
    server_params: StdioServerParameters | None = None,
) -> str:
    """Open a short-lived MCP session and call a single tool."""
    params = server_params or _DEFAULT_SERVER_PARAMS

    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            # MCP returns content as a list of content blocks
            parts = []
            for block in result.content:
                if hasattr(block, "text"):
                    parts.append(block.text)
            return "\n".join(parts) if parts else json.dumps({"status": "ok"})


def _run_async(coro: Any) -> Any:
    """Run an async coroutine from sync context."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # We're inside an existing event loop (e.g. Jupyter, CrewAI async)
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class ExecuteInput(BaseModel):
    intent: str = Field(description="Natural-language description of what to do in the browser")
    url: str = Field(description="Starting URL to navigate to")
    variables: Optional[dict[str, str]] = Field(
        default=None,
        description="Key-value variables to inject into the recipe",
    )


class ObserveInput(BaseModel):
    url: str = Field(description="URL to navigate to and observe")
    question: str = Field(description="Question to answer about the page content")


class PlanInput(BaseModel):
    goal: str = Field(description="High-level goal to decompose into browser steps")
    url: str = Field(description="Starting URL for the task")
    max_steps: int = Field(
        default=10,
        ge=1,
        le=20,
        description="Maximum number of steps to generate (default: 10)",
    )


# ---------------------------------------------------------------------------
# CrewAI Tools
# ---------------------------------------------------------------------------

class QuokkaExecuteTool(BaseTool):
    """Execute a browser automation task via Quokka."""

    name: str = "quokka_execute"
    description: str = (
        "Execute a browser automation task. Provide a natural-language intent "
        "and a starting URL. Returns the execution result including status and "
        "number of steps executed."
    )
    args_schema: Type[BaseModel] = ExecuteInput
    server_params: Optional[StdioServerParameters] = None

    model_config = {"arbitrary_types_allowed": True}

    def _run(
        self,
        intent: str,
        url: str,
        variables: dict[str, str] | None = None,
    ) -> str:
        args: dict[str, Any] = {"intent": intent, "url": url}
        if variables:
            args["variables"] = variables
        return _run_async(_call_mcp_tool("quokka_execute", args, self.server_params))


class QuokkaObserveTool(BaseTool):
    """Navigate to a URL and answer a question about the page content."""

    name: str = "quokka_observe"
    description: str = (
        "Navigate to a URL, capture a DOM snapshot of the page, and answer a "
        "question about what is visible. Returns the LLM answer based on the "
        "live page content."
    )
    args_schema: Type[BaseModel] = ObserveInput
    server_params: Optional[StdioServerParameters] = None

    model_config = {"arbitrary_types_allowed": True}

    def _run(self, url: str, question: str) -> str:
        return _run_async(
            _call_mcp_tool(
                "quokka_observe",
                {"url": url, "question": question},
                self.server_params,
            )
        )


class QuokkaPlanTool(BaseTool):
    """Decompose a high-level goal into concrete browser automation steps."""

    name: str = "quokka_plan"
    description: str = (
        "Decompose a high-level browser automation goal into a sequence of "
        "concrete steps. Returns a recipe JSON with ordered action steps."
    )
    args_schema: Type[BaseModel] = PlanInput
    server_params: Optional[StdioServerParameters] = None

    model_config = {"arbitrary_types_allowed": True}

    def _run(self, goal: str, url: str, max_steps: int = 10) -> str:
        return _run_async(
            _call_mcp_tool(
                "quokka_plan",
                {"goal": goal, "url": url, "maxSteps": max_steps},
                self.server_params,
            )
        )
