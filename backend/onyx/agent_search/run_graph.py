import asyncio
from asyncio import AbstractEventLoop
from collections.abc import AsyncIterable
from collections.abc import Iterable
from datetime import datetime
from typing import cast

from langchain_core.runnables.schema import StreamEvent
from langgraph.graph.state import CompiledStateGraph

from onyx.agent_search.basic.graph_builder import basic_graph_builder
from onyx.agent_search.basic.states import BasicInput
from onyx.agent_search.models import ProSearchConfig
from onyx.agent_search.pro_search_a.main.graph_builder import (
    main_graph_builder as main_graph_builder_a,
)
from onyx.agent_search.pro_search_a.main.states import MainInput as MainInput_a
from onyx.agent_search.pro_search_b.main.graph_builder import (
    main_graph_builder as main_graph_builder_b,
)
from onyx.agent_search.pro_search_b.main.states import MainInput as MainInput_b
from onyx.agent_search.shared_graph_utils.utils import get_test_config
from onyx.chat.llm_response_handler import LLMResponseHandlerManager
from onyx.chat.models import AgentAnswerPiece
from onyx.chat.models import AnswerPacket
from onyx.chat.models import AnswerStream
from onyx.chat.models import ExtendedToolResponse
from onyx.chat.models import StreamStopInfo
from onyx.chat.models import SubQueryPiece
from onyx.chat.models import SubQuestionPiece
from onyx.chat.models import ToolResponse
from onyx.chat.prompt_builder.build import LLMCall
from onyx.configs.dev_configs import GRAPH_NAME
from onyx.context.search.models import SearchRequest
from onyx.db.engine import get_session_context_manager
from onyx.tools.tool_runner import ToolCallKickoff
from onyx.utils.logger import setup_logger

logger = setup_logger()

_COMPILED_GRAPH: CompiledStateGraph | None = None


def _set_combined_token_value(
    combined_token: str, parsed_object: AgentAnswerPiece
) -> AgentAnswerPiece:
    parsed_object.answer_piece = combined_token

    return parsed_object


def _parse_agent_event(
    event: StreamEvent,
) -> AnswerPacket | None:
    """
    Parse the event into a typed object.
    Return None if we are not interested in the event.
    """

    event_type = event["event"]

    # We always just yield the event data, but this piece is useful for two development reasons:
    # 1. It's a list of the names of every place we dispatch a custom event
    # 2. We maintain the intended types yielded by each event
    if event_type == "on_custom_event":
        # TODO: different AnswerStream types for different events
        if event["name"] == "decomp_qs":
            return cast(SubQuestionPiece, event["data"])
        elif event["name"] == "subqueries":
            return cast(SubQueryPiece, event["data"])
        elif event["name"] == "sub_answers":
            return cast(AgentAnswerPiece, event["data"])
        elif event["name"] == "sub_answer_finished":
            return cast(StreamStopInfo, event["data"])
        elif event["name"] == "initial_agent_answer":
            return cast(AgentAnswerPiece, event["data"])
        elif event["name"] == "refined_agent_answer":
            return cast(AgentAnswerPiece, event["data"])
        elif event["name"] == "start_refined_answer_creation":
            return cast(ToolCallKickoff, event["data"])
        elif event["name"] == "tool_response":
            return cast(ToolResponse, event["data"])
        elif event["name"] == "basic_response":
            return cast(AnswerPacket, event["data"])
    return None


async def tear_down(event_loop: AbstractEventLoop) -> None:
    # Collect all tasks and cancel those that are not 'done'.
    tasks = asyncio.all_tasks(event_loop)
    for task in tasks:
        task.cancel()

    # Wait for all tasks to complete, ignoring any CancelledErrors
    try:
        await asyncio.wait(tasks)
    except asyncio.exceptions.CancelledError:
        pass


def _manage_async_event_streaming(
    compiled_graph: CompiledStateGraph,
    config: ProSearchConfig | None,
    graph_input: MainInput_a | MainInput_b | BasicInput,
) -> Iterable[StreamEvent]:
    async def _run_async_event_stream(
        loop: AbstractEventLoop,
    ) -> AsyncIterable[StreamEvent]:
        try:
            message_id = config.message_id if config else None
            async for event in compiled_graph.astream_events(
                input=graph_input,
                config={"metadata": {"config": config, "thread_id": str(message_id)}},
                # debug=True,
                # indicating v2 here deserves further scrutiny
                version="v2",
            ):
                yield event
        finally:
            await tear_down(loop)

    # This might be able to be simplified
    def _yield_async_to_sync() -> Iterable[StreamEvent]:
        loop = asyncio.new_event_loop()
        try:
            # Get the async generator
            async_gen = _run_async_event_stream(loop)
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
    config: ProSearchConfig | None,
    input: BasicInput | MainInput_a | MainInput_b,
) -> AnswerStream:
    input["base_question"] = config.search_request.query if config else ""
    for event in _manage_async_event_streaming(
        compiled_graph=compiled_graph, config=config, graph_input=input
    ):
        if not (parsed_object := _parse_agent_event(event)):
            continue

        yield parsed_object


# TODO: call this once on startup, TBD where and if it should be gated based
# on dev mode or not
def load_compiled_graph(graph_name: str) -> CompiledStateGraph:
    main_graph_builder = (
        main_graph_builder_a if graph_name == "a" else main_graph_builder_b
    )
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        graph = main_graph_builder()
        _COMPILED_GRAPH = graph.compile()
    return _COMPILED_GRAPH


def run_main_graph(
    config: ProSearchConfig,
    graph_name: str = "a",
) -> AnswerStream:
    compiled_graph = load_compiled_graph(graph_name)
    if graph_name == "a":
        input = MainInput_a()
    else:
        input = MainInput_b()

    # Agent search is not a Tool per se, but this is helpful for the frontend
    yield ToolCallKickoff(
        tool_name="agent_search_0",
        tool_args={"query": config.search_request.query},
    )
    yield from run_graph(compiled_graph, config, input)


# TODO: unify input types, especially prosearchconfig
def run_basic_graph(
    config: ProSearchConfig,
    last_llm_call: LLMCall | None,
    response_handler_manager: LLMResponseHandlerManager,
) -> AnswerStream:
    graph = basic_graph_builder()
    compiled_graph = graph.compile()
    # TODO: unify basic input
    input = BasicInput(
        base_question="",
        last_llm_call=last_llm_call,
        response_handler_manager=response_handler_manager,
        calls=0,
    )
    return run_graph(compiled_graph, None, input)


if __name__ == "__main__":
    from onyx.llm.factory import get_default_llms

    now_start = datetime.now()
    logger.debug(f"Start at {now_start}")

    if GRAPH_NAME == "a":
        graph = main_graph_builder_a()
    else:
        graph = main_graph_builder_b()
    compiled_graph = graph.compile()
    now_end = datetime.now()
    logger.debug(f"Graph compiled in {now_end - now_start} seconds")
    primary_llm, fast_llm = get_default_llms()
    search_request = SearchRequest(
        # query="what can you do with gitlab?",
        query="What are the guiding principles behind the development of cockroachDB",
        # query="What are the temperatures in Munich, Hawaii, and New York?",
    )
    # Joachim custom persona

    with get_session_context_manager() as db_session:
        config, search_tool = get_test_config(
            db_session, primary_llm, fast_llm, search_request
        )
        # search_request.persona = get_persona_by_id(1, None, db_session)
        config.use_persistence = True

        if GRAPH_NAME == "a":
            input = MainInput_a()
        else:
            input = MainInput_b()
        # with open("output.txt", "w") as f:
        tool_responses: list = []
        for output in run_graph(compiled_graph, config, input):
            # pass

            if isinstance(output, ToolCallKickoff):
                pass
            elif isinstance(output, ExtendedToolResponse):
                tool_responses.append(output.response)
                logger.info(
                    f"   ---- ET {output.level} - {output.level_question_nr} |  "
                )
            elif isinstance(output, SubQueryPiece):
                logger.info(
                    f"Sq {output.level} - {output.level_question_nr} - {output.sub_query} | "
                )
            elif isinstance(output, SubQuestionPiece):
                logger.info(
                    f"SQ {output.level} - {output.level_question_nr} - {output.sub_question} | "
                )
            elif (
                isinstance(output, AgentAnswerPiece)
                and output.answer_type == "agent_sub_answer"
            ):
                logger.info(
                    f"   ---- SA {output.level} - {output.level_question_nr} {output.answer_piece} | "
                )
            elif (
                isinstance(output, AgentAnswerPiece)
                and output.answer_type == "agent_level_answer"
            ):
                logger.info(
                    f"   ---------- FA {output.level} - {output.level_question_nr}  {output.answer_piece} | "
                )

        # for tool_response in tool_responses:
        #    logger.debug(tool_response)
