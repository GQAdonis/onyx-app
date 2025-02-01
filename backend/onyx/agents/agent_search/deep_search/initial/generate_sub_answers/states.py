from typing import TypedDict

from onyx.agents.agent_search.core_state import CoreState
from onyx.agents.agent_search.deep_search.main.states import (
    InitialAnswerUpdate,
)
from onyx.agents.agent_search.deep_search.main.states import (
    InitialQuestionDecompositionUpdate,
)
from onyx.agents.agent_search.deep_search.main.states import (
    SubQuestionResultsUpdate,
)

### States ###


class SubQuestionAnsweringInput(CoreState):
    pass


## Graph State


class SubQuestionAnsweringState(
    # This includes the core state
    SubQuestionAnsweringInput,
    InitialQuestionDecompositionUpdate,
    InitialAnswerUpdate,
    SubQuestionResultsUpdate,
):
    # expanded_retrieval_result: Annotated[list[ExpandedRetrievalResult], add]
    pass


## Graph Output State - presently not used


class SubQuestionAnsweringOutput(TypedDict):
    log_messages: list[str]
