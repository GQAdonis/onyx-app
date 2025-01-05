from collections.abc import Hashable
from typing import Literal

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.main.states import MainState
from onyx.agent_search.main.states import RequireRefinedAnswerUpdate
from onyx.utils.logger import setup_logger

logger = setup_logger()


def parallelize_decompozed_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["initial_decomp_questions"]) > 0:
        # sub_question_record_ids = [subq_record.id for subq_record in state["sub_question_records"]]
        # if len(state["sub_question_records"]) == 0:
        #     if state["config"].use_persistence:
        #         raise ValueError("No sub-questions found for initial decompozed questions")
        #     else:
        #         # in this case, we are doing retrieval on the original question.
        #         # to make all the logic consistent, we create a new sub-question
        #         # with the same content as the original question
        #         sub_question_record_ids = [1] * len(state["initial_decomp_questions"])

        return [
            Send(
                "answer_query",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question,
                    question_nr="0_" + str(question_nr),
                ),
            )
            for question_nr, question in enumerate(state["initial_decomp_questions"])
        ]

    else:
        return [
            Send(
                "ingest_answers",
                AnswerQuestionOutput(
                    answer_results=[],
                ),
            )
        ]


# Define the function that determines whether to continue or not
def continue_to_refined_answer_or_end(
    state: RequireRefinedAnswerUpdate,
) -> Literal["follow_up_decompose", "logging_node"]:
    if state["require_refined_answer"]:
        return "follow_up_decompose"
    else:
        return "logging_node"


def parallelize_follow_up_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["follow_up_sub_questions"]) > 0:
        return [
            Send(
                "answer_follow_up_question",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question_data.sub_question,
                    question_nr="1_" + str(question_nr),
                ),
            )
            for question_nr, question_data in state["follow_up_sub_questions"].items()
        ]

    else:
        return [
            Send(
                "ingest_follow_up_answers",
                AnswerQuestionOutput(
                    answer_results=[],
                ),
            )
        ]
