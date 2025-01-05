import asyncio
from collections.abc import AsyncIterable
from collections.abc import Iterable

from langchain_core.runnables.schema import StreamEvent
from langgraph.graph.state import CompiledStateGraph

from onyx.agent_search.main.graph_builder import main_graph_builder
from onyx.agent_search.main.states import MainInput
from onyx.chat.answer import AnswerStream
from onyx.chat.models import AnswerQuestionPossibleReturn
from onyx.chat.models import OnyxAnswerPiece
from onyx.context.search.models import SearchRequest
from onyx.db.engine import get_session_context_manager
from onyx.llm.interfaces import LLM
from onyx.tools.models import ToolResponse
from onyx.tools.tool_runner import ToolCallKickoff
from onyx.utils.logger import setup_logger

logger = setup_logger()


def _parse_agent_event(
    event: StreamEvent,
) -> AnswerQuestionPossibleReturn | ToolCallKickoff | ToolResponse | None:
    """
    Parse the event into a typed object.
    Return None if we are not interested in the event.
    """
    # if event["name"] == "LangGraph":
    #    return None

    event_type = event["event"]
    langgraph_node = event["metadata"].get("langgraph_node", "_graph_")
    if "input" in event["data"] and isinstance(event["data"]["input"], str):
        input_data = f'\nINPUT: {langgraph_node} -- {str(event["data"]["input"])}'
    else:
        input_data = ""
    if "output" in event["data"] and isinstance(event["data"]["output"], str):
        output_data = f'\nOUTPUT: {langgraph_node} -- {str(event["data"]["output"])}'
    else:
        output_data = ""
    if len(input_data) > 0 or len(output_data) > 0:
        return input_data + output_data

    event_type = event["event"]
    if event_type == "tool_call_kickoff":
        return ToolCallKickoff(**event["data"])
    elif event_type == "tool_response":
        return ToolResponse(**event["data"])
    elif event_type == "on_chat_model_stream":
        return OnyxAnswerPiece(answer_piece=event["data"]["chunk"].content)
    return None


def _manage_async_event_streaming(
    compiled_graph: CompiledStateGraph,
    graph_input: MainInput,
) -> Iterable[StreamEvent]:
    async def _run_async_event_stream() -> AsyncIterable[StreamEvent]:
        async for event in compiled_graph.astream_events(
            input=graph_input,
            # indicating v2 here deserves further scrutiny
            version="v2",
        ):
            yield event

    # This might be able to be simplified
    def _yield_async_to_sync() -> Iterable[StreamEvent]:
        loop = asyncio.new_event_loop()
        try:
            # Get the async generator
            async_gen = _run_async_event_stream()
            # Convert to AsyncIterator
            async_iter = async_gen.__aiter__()
            while True:
                try:
                    # Create a coroutine by calling anext with the async iterator
                    next_coro = anext(async_iter)
                    # Run the coroutine to get the next event
                    event = loop.run_until_complete(next_coro)
                    yield event
                except StopAsyncIteration:
                    break
        finally:
            loop.close()

    return _yield_async_to_sync()


def run_graph(
    compiled_graph: CompiledStateGraph,
    search_request: SearchRequest,
    primary_llm: LLM,
    fast_llm: LLM,
) -> AnswerStream:
    with get_session_context_manager() as db_session:
        from onyx.db.persona import get_persona_by_id

        search_request.persona = get_persona_by_id(1, None, db_session)

        input = MainInput(
            search_request=search_request,
            primary_llm=primary_llm,
            fast_llm=fast_llm,
            db_session=db_session,
        )
        for event in _manage_async_event_streaming(
            compiled_graph=compiled_graph, graph_input=input
        ):
            if parsed_object := _parse_agent_event(event):
                yield parsed_object


if __name__ == "__main__":
    from onyx.llm.factory import get_default_llms
    from onyx.context.search.models import SearchRequest

    graph = main_graph_builder()
    compiled_graph = graph.compile()
    primary_llm, fast_llm = get_default_llms()
    search_request = SearchRequest(
        query="What are the guiding principles behind the development of cockroachDB?",
        # query="What are the tempereatures in Munich and New York?",
    )
    for output in run_graph(compiled_graph, search_request, primary_llm, fast_llm):
        logger.debug(output)
