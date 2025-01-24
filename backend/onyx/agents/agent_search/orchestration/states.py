from pydantic import BaseModel

from onyx.chat.prompt_builder.answer_prompt_builder import PromptSnapshot
from onyx.tools.message import ToolCallSummary
from onyx.tools.models import ToolCallFinalResult
from onyx.tools.models import ToolCallKickoff
from onyx.tools.models import ToolResponse
from onyx.tools.tool import Tool


class ToolChoiceInput(BaseModel):
    should_stream_answer: bool = True
    # default to the prompt builder from the config, but
    # allow overrides for arbitrary tool calls
    prompt_snapshot: PromptSnapshot | None = None


class ToolCallOutput(BaseModel):
    tool_call_summary: ToolCallSummary
    tool_call_kickoff: ToolCallKickoff
    tool_call_responses: list[ToolResponse]
    tool_call_final_result: ToolCallFinalResult


class ToolCallUpdate(BaseModel):
    tool_call_output: ToolCallOutput | None = None


class ToolChoice(BaseModel):
    tool: Tool
    tool_args: dict
    id: str | None

    class Config:
        arbitrary_types_allowed = True


class ToolChoiceUpdate(BaseModel):
    tool_choice: ToolChoice | None = None


class ToolChoiceState(ToolChoiceUpdate, ToolChoiceInput):
    pass
