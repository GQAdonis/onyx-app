from operator import add
from typing import Annotated
from typing import TypedDict

from pydantic import BaseModel

from onyx.agent_search.core_state import CoreState
from onyx.agent_search.expanded_retrieval.models import QueryResult
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.context.search.models import InferenceSection

### Models ###


class AnswerRetrievalStats(BaseModel):
    answer_retrieval_stats: dict[str, float | int]


class QuestionAnswerResults(BaseModel):
    question: str
    answer: str
    quality: str
    expanded_retrieval_results: list[QueryResult]
    documents: list[InferenceSection]
    sub_question_retrieval_stats: AgentChunkStats


### States ###

## Update States


class QACheckUpdate(TypedDict):
    answer_quality: str


class QAGenerationUpdate(TypedDict):
    answer: str
    # answer_stat: AnswerStats


class RetrievalIngestionUpdate(TypedDict):
    expanded_retrieval_results: list[QueryResult]
    documents: Annotated[list[InferenceSection], dedup_inference_sections]
    sub_question_retrieval_stats: AgentChunkStats


## Graph Input State


class AnswerQuestionInput(CoreState):
    question: str


## Graph State


class AnswerQuestionState(
    AnswerQuestionInput,
    QAGenerationUpdate,
    QACheckUpdate,
    RetrievalIngestionUpdate,
):
    pass


## Graph Output State


class AnswerQuestionOutput(TypedDict):
    """
    This is a list of results even though each call of this subgraph only returns one result.
    This is because if we parallelize the answer query subgraph, there will be multiple
      results in a list so the add operator is used to add them together.
    """

    answer_results: Annotated[list[QuestionAnswerResults], add]
