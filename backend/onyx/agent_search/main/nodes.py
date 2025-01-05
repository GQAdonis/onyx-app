import json
import re
from datetime import datetime
from typing import Any
from typing import cast

from langchain_core.callbacks.manager import dispatch_custom_event
from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_content
from langchain_core.messages import merge_message_runs

from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.base_raw_search.states import BaseRawSearchOutput
from onyx.agent_search.main.models import AgentAdditionalMetrics
from onyx.agent_search.main.models import AgentBaseMetrics
from onyx.agent_search.main.models import AgentRefinedMetrics
from onyx.agent_search.main.models import AgentTimings
from onyx.agent_search.main.models import CombinedAgentMetrics
from onyx.agent_search.main.models import Entity
from onyx.agent_search.main.models import EntityRelationshipTermExtraction
from onyx.agent_search.main.models import FollowUpSubQuestion
from onyx.agent_search.main.models import Relationship
from onyx.agent_search.main.models import Term
from onyx.agent_search.main.states import BaseDecompUpdate
from onyx.agent_search.main.states import DecompAnswersUpdate
from onyx.agent_search.main.states import EntityTermExtractionUpdate
from onyx.agent_search.main.states import ExpandedRetrievalUpdate
from onyx.agent_search.main.states import FollowUpDecompAnswersUpdate
from onyx.agent_search.main.states import FollowUpSubQuestionsUpdate
from onyx.agent_search.main.states import InitialAnswerBASEUpdate
from onyx.agent_search.main.states import InitialAnswerQualityUpdate
from onyx.agent_search.main.states import InitialAnswerUpdate
from onyx.agent_search.main.states import MainOutput
from onyx.agent_search.main.states import MainState
from onyx.agent_search.main.states import RefinedAnswerUpdate
from onyx.agent_search.main.states import RequireRefinedAnswerUpdate
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import InitialAgentResultStats
from onyx.agent_search.shared_graph_utils.models import RefinedAgentStats
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_DEFAULT
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_PERSONA
from onyx.agent_search.shared_graph_utils.prompts import DEEP_DECOMPOSE_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import ENTITY_TERM_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_DECOMPOSITION_PROMPT_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_BASE_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import REVISED_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    REVISED_RAG_PROMPT_NO_SUB_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import SUB_QUESTION_ANSWER_TEMPLATE
from onyx.agent_search.shared_graph_utils.utils import format_docs
from onyx.agent_search.shared_graph_utils.utils import format_entity_term_extraction
from onyx.agent_search.shared_graph_utils.utils import get_persona_prompt
from onyx.chat.models import SubQuestion
from onyx.db.chat import log_agent_metrics
from onyx.utils.logger import setup_logger

logger = setup_logger()


def dispatch_subquestion(sub_question_part: str, subq_id: int) -> None:
    dispatch_custom_event(
        "decomp_qs",
        SubQuestion(
            sub_question=sub_question_part,
            question_id=subq_id,
        ),
    )


def main_decomp_base(state: MainState) -> BaseDecompUpdate:
    question = state["config"].search_request.query
    state["db_session"]
    chat_session_id = state["config"].chat_session_id
    primary_message_id = state["config"].message_id

    if not chat_session_id or not primary_message_id:
        raise ValueError(
            "chat_session_id and message_id must be provided for agent search"
        )
    agent_start_time = datetime.now()
    msg = [
        HumanMessage(
            content=INITIAL_DECOMPOSITION_PROMPT_QUESTIONS.format(question=question),
        )
    ]

    # Get the rewritten queries in a defined format
    model = state["fast_llm"]
    streamed_tokens: list[str | list[str | dict[str, Any]]] = [""]
    subq_id = 1
    for message in model.stream(msg):
        content = cast(str, message.content)
        if "\n" in content:
            for sub_question_part in content.split("\n"):
                dispatch_subquestion(sub_question_part, subq_id)
                subq_id += 1
            subq_id -= 1  # fencepost; extra increment at end of loop
        else:
            dispatch_subquestion(content, subq_id)

        streamed_tokens.append(content)

    response = merge_content(*streamed_tokens)

    # this call should only return strings. Commenting out for efficiency
    # assert [type(tok) == str for tok in streamed_tokens]

    # use no-op cast() instead of str() which runs code
    # list_of_subquestions = clean_and_parse_list_string(cast(str, response))
    list_of_subquestions = cast(str, response).split("\n")

    decomp_list: list[str] = [
        sub_question.strip() for sub_question in list_of_subquestions
    ]

    # Persist sub-questions to database
    # from onyx.agent_search.db_operations import create_sub_question

    if state["config"].use_persistence:
        # for sub_q in decomp_list:
        #     sub_questions.append(
        #         create_sub_question(
        #             db_session=db_session,
        #             chat_session_id=chat_session_id,
        #             primary_message_id=primary_message_id,
        #             sub_question=sub_q,
        #         )
        #     )
        pass

    return BaseDecompUpdate(
        initial_decomp_questions=decomp_list,
        agent_start_time=agent_start_time,
    )


def _calculate_initial_agent_stats(
    decomp_answer_results: list[QuestionAnswerResults],
    original_question_stats: AgentChunkStats,
) -> InitialAgentResultStats:
    initial_agent_result_stats: InitialAgentResultStats = InitialAgentResultStats(
        sub_questions={},
        original_question={},
        agent_effectiveness={},
    )

    orig_verified = original_question_stats.verified_count
    orig_support_score = original_question_stats.verified_avg_scores

    verified_document_chunk_ids = []
    support_scores = 0.0

    for decomp_answer_result in decomp_answer_results:
        verified_document_chunk_ids += (
            decomp_answer_result.sub_question_retrieval_stats.verified_doc_chunk_ids
        )
        if (
            decomp_answer_result.sub_question_retrieval_stats.verified_avg_scores
            is not None
        ):
            support_scores += (
                decomp_answer_result.sub_question_retrieval_stats.verified_avg_scores
            )

    verified_document_chunk_ids = list(set(verified_document_chunk_ids))

    # Calculate sub-question stats
    if (
        verified_document_chunk_ids
        and len(verified_document_chunk_ids) > 0
        and support_scores is not None
    ):
        sub_question_stats: dict[str, float | int | None] = {
            "num_verified_documents": len(verified_document_chunk_ids),
            "verified_avg_score": float(support_scores / len(decomp_answer_results)),
        }
    else:
        sub_question_stats = {"num_verified_documents": 0, "verified_avg_score": None}

    initial_agent_result_stats.sub_questions.update(sub_question_stats)

    # Get original question stats
    initial_agent_result_stats.original_question.update(
        {
            "num_verified_documents": original_question_stats.verified_count,
            "verified_avg_score": original_question_stats.verified_avg_scores,
        }
    )

    # Calculate chunk utilization ratio
    sub_verified = initial_agent_result_stats.sub_questions["num_verified_documents"]

    chunk_ratio: float | None = None
    if sub_verified is not None and orig_verified is not None and orig_verified > 0:
        chunk_ratio = (float(sub_verified) / orig_verified) if sub_verified > 0 else 0.0
    elif sub_verified is not None and sub_verified > 0:
        chunk_ratio = 10.0

    initial_agent_result_stats.agent_effectiveness["utilized_chunk_ratio"] = chunk_ratio

    if (
        orig_support_score is None
        or orig_support_score == 0.0
        and initial_agent_result_stats.sub_questions["verified_avg_score"] is None
    ):
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = None
    elif orig_support_score is None or orig_support_score == 0.0:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = 10
    elif initial_agent_result_stats.sub_questions["verified_avg_score"] is None:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = 0
    else:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = (
            initial_agent_result_stats.sub_questions["verified_avg_score"]
            / orig_support_score
        )

    return initial_agent_result_stats


def generate_initial_answer(state: MainState) -> InitialAnswerUpdate:
    logger.info("---GENERATE INITIAL---")

    question = state["config"].search_request.query
    persona_prompt = get_persona_prompt(state["config"].search_request.persona)
    sub_question_docs = state["documents"]
    all_original_question_documents = state["all_original_question_documents"]

    relevant_docs = dedup_inference_sections(
        sub_question_docs, all_original_question_documents
    )

    net_new_original_question_docs = []
    for all_original_question_doc in all_original_question_documents:
        if all_original_question_doc not in sub_question_docs:
            net_new_original_question_docs.append(all_original_question_doc)

    decomp_answer_results = state["decomp_answer_results"]

    good_qa_list: list[str] = []
    decomp_questions = []

    for decomp_answer_result in decomp_answer_results:
        decomp_questions.append(decomp_answer_result.question)
        if (
            decomp_answer_result.quality.lower().startswith("yes")
            and len(decomp_answer_result.answer) > 0
            and decomp_answer_result.answer != "I don't know"
        ):
            good_qa_list.append(
                SUB_QUESTION_ANSWER_TEMPLATE.format(
                    sub_question=decomp_answer_result.question,
                    sub_answer=decomp_answer_result.answer,
                )
            )

    if len(good_qa_list) > 0:
        sub_question_answer_str = "\n\n------\n\n".join(good_qa_list)
    else:
        sub_question_answer_str = ""

    # Determine which persona-specification prompt to use

    if len(persona_prompt) > 0:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_DEFAULT
    else:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_PERSONA.format(
            persona_prompt=persona_prompt
        )

    # Determine which base prompt to use given the sub-question information
    if len(good_qa_list) > 0:
        base_prompt = INITIAL_RAG_PROMPT
    else:
        base_prompt = INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS

    msg = [
        HumanMessage(
            content=base_prompt.format(
                question=question,
                answered_sub_questions=sub_question_answer_str,
                relevant_docs=format_docs(relevant_docs),
                persona_specification=persona_specification,
            )
        )
    ]

    model = state["fast_llm"]
    streamed_tokens: list[str | list[str | dict[str, Any]]] = [""]
    for message in model.stream(msg):
        dispatch_custom_event(
            "main_answer",
            message.content,
        )
        streamed_tokens.append(message.content)
    response = merge_content(*streamed_tokens)
    answer = cast(str, response)

    initial_agent_stats = _calculate_initial_agent_stats(
        state["decomp_answer_results"], state["original_question_retrieval_stats"]
    )

    logger.info(f"\n\n---INITIAL AGENT ANSWER START---\n\n Answer:\n Agent: {answer}")

    logger.info(f"\n\nSub-Questions:\n\n{sub_question_answer_str}\n\nStats:\n\n")

    if initial_agent_stats:
        logger.info(initial_agent_stats.original_question)
        logger.info(initial_agent_stats.sub_questions)
        logger.info(initial_agent_stats.agent_effectiveness)
    logger.info("\n\n ---INITIAL AGENT ANSWER  END---\n\n")

    agent_base_end_time = datetime.now()

    agent_base_metrics = AgentBaseMetrics(
        num_verified_documents_total=len(relevant_docs),
        num_verified_documents_core=state[
            "original_question_retrieval_stats"
        ].verified_count,
        verified_avg_score_core=state[
            "original_question_retrieval_stats"
        ].verified_avg_scores,
        num_verified_documents_base=initial_agent_stats.sub_questions.get(
            "num_verified_documents", None
        ),
        verified_avg_score_base=initial_agent_stats.sub_questions.get(
            "verified_avg_score", None
        ),
        base_doc_boost_factor=initial_agent_stats.agent_effectiveness.get(
            "utilized_chunk_ratio", None
        ),
        support_boost_factor=initial_agent_stats.agent_effectiveness.get(
            "support_ratio", None
        ),
        duration_s=(agent_base_end_time - state["agent_start_time"]).total_seconds(),
    )

    return InitialAnswerUpdate(
        initial_answer=answer,
        initial_agent_stats=initial_agent_stats,
        generated_sub_questions=decomp_questions,
        agent_base_end_time=agent_base_end_time,
        agent_base_metrics=agent_base_metrics,
    )


def initial_answer_quality_check(state: MainState) -> InitialAnswerQualityUpdate:
    """
    Check whether the final output satisfies the original user question

    Args:
        state (messages): The current state

    Returns:
        InitialAnswerQualityUpdate
    """

    logger.info("Checking for base answer validity - for not set True/False manually")

    verdict = True

    return InitialAnswerQualityUpdate(initial_answer_quality=verdict)


def entity_term_extraction(state: MainState) -> EntityTermExtractionUpdate:
    logger.info("---GENERATE ENTITIES & TERMS---")

    # first four lines duplicates from generate_initial_answer
    question = state["config"].search_request.query
    sub_question_docs = state["documents"]
    all_original_question_documents = state["all_original_question_documents"]
    relevant_docs = dedup_inference_sections(
        sub_question_docs, all_original_question_documents
    )

    # start with the entity/term/extraction

    doc_context = format_docs(relevant_docs)

    msg = [
        HumanMessage(
            content=ENTITY_TERM_PROMPT.format(question=question, context=doc_context),
        )
    ]
    fast_llm = state["fast_llm"]
    # Grader
    llm_response_list = list(
        fast_llm.stream(
            prompt=msg,
        )
    )
    llm_response = merge_message_runs(llm_response_list, chunk_separator="")[0].content

    cleaned_response = re.sub(r"```json\n|\n```", "", llm_response)
    parsed_response = json.loads(cleaned_response)

    entities = []
    relationships = []
    terms = []
    for entity in parsed_response.get("retrieved_entities_relationships", {}).get(
        "entities", {}
    ):
        entity_name = entity.get("entity_name", "")
        entity_type = entity.get("entity_type", "")
        entities.append(Entity(entity_name=entity_name, entity_type=entity_type))

    for relationship in parsed_response.get("retrieved_entities_relationships", {}).get(
        "relationships", {}
    ):
        relationship_name = relationship.get("relationship_name", "")
        relationship_type = relationship.get("relationship_type", "")
        relationship_entities = relationship.get("relationship_entities", [])
        relationships.append(
            Relationship(
                relationship_name=relationship_name,
                relationship_type=relationship_type,
                relationship_entities=relationship_entities,
            )
        )

    for term in parsed_response.get("retrieved_entities_relationships", {}).get(
        "terms", {}
    ):
        term_name = term.get("term_name", "")
        term_type = term.get("term_type", "")
        term_similar_to = term.get("term_similar_to", [])
        terms.append(
            Term(
                term_name=term_name,
                term_type=term_type,
                term_similar_to=term_similar_to,
            )
        )

    return EntityTermExtractionUpdate(
        entity_retlation_term_extractions=EntityRelationshipTermExtraction(
            entities=entities,
            relationships=relationships,
            terms=terms,
        )
    )


def generate_initial_base_answer(state: MainState) -> InitialAnswerBASEUpdate:
    logger.info("---GENERATE INITIAL BASE ANSWER---")

    question = state["config"].search_request.query
    original_question_docs = state["all_original_question_documents"]

    msg = [
        HumanMessage(
            content=INITIAL_RAG_BASE_PROMPT.format(
                question=question,
                context=format_docs(original_question_docs),
            )
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    logger.info(
        f"\n\n---INITIAL BASE ANSWER START---\n\nBase:  {answer}\n\n  ---INITIAL BASE ANSWER  END---\n\n"
    )
    return InitialAnswerBASEUpdate(initial_base_answer=answer)


def ingest_answers(state: AnswerQuestionOutput) -> DecompAnswersUpdate:
    documents = []
    answer_results = state.get("answer_results", [])
    for answer_result in answer_results:
        documents.extend(answer_result.documents)
    return DecompAnswersUpdate(
        # Deduping is done by the documents operator for the main graph
        # so we might not need to dedup here
        documents=dedup_inference_sections(documents, []),
        decomp_answer_results=answer_results,
    )


def ingest_initial_retrieval(state: BaseRawSearchOutput) -> ExpandedRetrievalUpdate:
    sub_question_retrieval_stats = state[
        "base_expanded_retrieval_result"
    ].sub_question_retrieval_stats
    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = AgentChunkStats()
    else:
        sub_question_retrieval_stats = sub_question_retrieval_stats

    return ExpandedRetrievalUpdate(
        original_question_retrieval_results=state[
            "base_expanded_retrieval_result"
        ].expanded_queries_results,
        all_original_question_documents=state[
            "base_expanded_retrieval_result"
        ].all_documents,
        original_question_retrieval_stats=sub_question_retrieval_stats,
    )


def refined_answer_decision(state: MainState) -> RequireRefinedAnswerUpdate:
    logger.info("---REFINED ANSWER DECISION---")

    if False:
        return RequireRefinedAnswerUpdate(require_refined_answer=False)

    else:
        return RequireRefinedAnswerUpdate(require_refined_answer=True)


def generate_refined_answer(state: MainState) -> RefinedAnswerUpdate:
    logger.info("---GENERATE REFINED ANSWER---")

    question = state["config"].search_request.query
    persona_prompt = get_persona_prompt(state["config"].search_request.persona)

    initial_documents = state["documents"]
    revised_documents = state["follow_up_documents"]

    combined_documents = dedup_inference_sections(initial_documents, revised_documents)

    if len(initial_documents) > 0:
        revision_doc_effectiveness = len(combined_documents) / len(initial_documents)
    elif len(revised_documents) == 0:
        revision_doc_effectiveness = 0.0
    else:
        revision_doc_effectiveness = 10.0

    decomp_answer_results = state["decomp_answer_results"]
    revised_answer_results = state["follow_up_decomp_answer_results"]

    good_qa_list: list[str] = []
    decomp_questions = []

    initial_good_sub_questions: list[str] = []
    new_revised_good_sub_questions: list[str] = []

    for answer_set in [decomp_answer_results, revised_answer_results]:
        for decomp_answer_result in answer_set:
            decomp_questions.append(decomp_answer_result.question)
            if (
                decomp_answer_result.quality.lower().startswith("yes")
                and len(decomp_answer_result.answer) > 0
                and decomp_answer_result.answer != "I don't know"
            ):
                good_qa_list.append(
                    SUB_QUESTION_ANSWER_TEMPLATE.format(
                        sub_question=decomp_answer_result.question,
                        sub_answer=decomp_answer_result.answer,
                    )
                )
                if answer_set == decomp_answer_results:
                    initial_good_sub_questions.append(decomp_answer_result.question)
                else:
                    new_revised_good_sub_questions.append(decomp_answer_result.question)

    initial_good_sub_questions = list(set(initial_good_sub_questions))
    new_revised_good_sub_questions = list(set(new_revised_good_sub_questions))
    total_good_sub_questions = list(
        set(initial_good_sub_questions + new_revised_good_sub_questions)
    )
    if len(initial_good_sub_questions) > 0:
        revision_question_efficiency: float = len(total_good_sub_questions) / len(
            initial_good_sub_questions
        )
    elif len(new_revised_good_sub_questions) > 0:
        revision_question_efficiency = 10.0
    else:
        revision_question_efficiency = 1.0

    sub_question_answer_str = "\n\n------\n\n".join(list(set(good_qa_list)))

    # original answer

    initial_answer = state["initial_answer"]

    # Determine which persona-specification prompt to use

    if len(persona_prompt) > 0:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_DEFAULT
    else:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_PERSONA.format(
            persona_prompt=persona_prompt
        )

    # Determine which base prompt to use given the sub-question information
    if len(good_qa_list) > 0:
        base_prompt = REVISED_RAG_PROMPT
    else:
        base_prompt = REVISED_RAG_PROMPT_NO_SUB_QUESTIONS

    msg = [
        HumanMessage(
            content=base_prompt.format(
                question=question,
                answered_sub_questions=sub_question_answer_str,
                relevant_docs=format_docs(combined_documents),
                initial_answer=initial_answer,
                persona_specification=persona_specification,
            )
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    # refined_agent_stats = _calculate_refined_agent_stats(
    #     state["decomp_answer_results"], state["original_question_retrieval_stats"]
    # )

    initial_good_sub_questions_str = "\n".join(list(set(initial_good_sub_questions)))
    new_revised_good_sub_questions_str = "\n".join(
        list(set(new_revised_good_sub_questions))
    )

    refined_agent_stats = RefinedAgentStats(
        revision_doc_efficiency=revision_doc_effectiveness,
        revision_question_efficiency=revision_question_efficiency,
    )

    logger.info(f"\n\n---INITIAL ANSWER START---\n\n Answer:\n Agent: {initial_answer}")
    logger.info("-" * 10)
    logger.info(f"\n\n---REVISED AGENT ANSWER START---\n\n Answer:\n Agent: {answer}")

    logger.info("-" * 100)
    logger.info(f"\n\nINITAL Sub-Questions\n\n{initial_good_sub_questions_str}\n\n")
    logger.info("-" * 10)
    logger.info(
        f"\n\nNEW REVISED Sub-Questions\n\n{new_revised_good_sub_questions_str}\n\n"
    )

    logger.info("-" * 100)

    logger.info(
        f"\n\nINITAL & REVISED Sub-Questions & Answers:\n\n{sub_question_answer_str}\n\nStas:\n\n"
    )

    logger.info("-" * 100)

    if state["initial_agent_stats"]:
        initial_doc_boost_factor = state["initial_agent_stats"].agent_effectiveness.get(
            "utilized_chunk_ratio", "--"
        )
        initial_support_boost_factor = state[
            "initial_agent_stats"
        ].agent_effectiveness.get("support_ratio", "--")
        num_initial_verified_docs = state["initial_agent_stats"].original_question.get(
            "num_verified_documents", "--"
        )
        initial_verified_docs_avg_score = state[
            "initial_agent_stats"
        ].original_question.get("verified_avg_score", "--")
        initial_sub_questions_verified_docs = state[
            "initial_agent_stats"
        ].sub_questions.get("num_verified_documents", "--")

        logger.info("INITIAL AGENT STATS")
        logger.info(f"Document Boost Factor: {initial_doc_boost_factor}")
        logger.info(f"Support Boost Factor: {initial_support_boost_factor}")
        logger.info(f"Originally Verified Docs: {num_initial_verified_docs}")
        logger.info(
            f"Originally Verified Docs Avg Score: {initial_verified_docs_avg_score}"
        )
        logger.info(
            f"Sub-Questions Verified Docs: {initial_sub_questions_verified_docs}"
        )
    if refined_agent_stats:
        logger.info("-" * 10)
        logger.info("REFINED AGENT STATS")
        logger.info(
            f"Revision Doc Factor: {refined_agent_stats.revision_doc_efficiency}"
        )
        logger.info(
            f"Revision Question Factor: {refined_agent_stats.revision_question_efficiency}"
        )

    logger.info("\n\n ---INITIAL AGENT ANSWER  END---\n\n")

    agent_refined_end_time = datetime.now()
    agent_refined_duration = (
        agent_refined_end_time - state["agent_refined_start_time"]
    ).total_seconds()

    agent_refined_metrics = AgentRefinedMetrics(
        refined_doc_boost_factor=refined_agent_stats.revision_doc_efficiency,
        refined_question_boost_factor=refined_agent_stats.revision_question_efficiency,
        duration_s=agent_refined_duration,
    )

    return RefinedAnswerUpdate(
        refined_answer=answer,
        refined_answer_quality=True,  # TODO: replace this with the actual check value
        refined_agent_stats=refined_agent_stats,
        agent_refined_end_time=agent_refined_end_time,
        agent_refined_metrics=agent_refined_metrics,
    )


def follow_up_decompose(state: MainState) -> FollowUpSubQuestionsUpdate:
    """ """

    agent_refined_start_time = datetime.now()

    question = state["config"].search_request.query
    base_answer = state["initial_answer"]

    # get the entity term extraction dict and properly format it
    entity_retlation_term_extractions = state["entity_retlation_term_extractions"]

    entity_term_extraction_str = format_entity_term_extraction(
        entity_retlation_term_extractions
    )

    initial_question_answers = state["decomp_answer_results"]

    addressed_question_list = [
        x.question for x in initial_question_answers if "yes" in x.quality.lower()
    ]

    failed_question_list = [
        x.question for x in initial_question_answers if "no" in x.quality.lower()
    ]

    msg = [
        HumanMessage(
            content=DEEP_DECOMPOSE_PROMPT.format(
                question=question,
                entity_term_extraction_str=entity_term_extraction_str,
                base_answer=base_answer,
                answered_sub_questions="\n - ".join(addressed_question_list),
                failed_sub_questions="\n - ".join(failed_question_list),
            ),
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)

    if isinstance(response.content, str):
        cleaned_response = re.sub(r"```json\n|\n```", "", response.content)
        parsed_response = json.loads(cleaned_response)
    else:
        raise ValueError("LLM response is not a string")

    follow_up_sub_question_dict = {}
    for sub_question_nr, sub_question_dict in enumerate(
        parsed_response["sub_questions"]
    ):
        follow_up_sub_question = FollowUpSubQuestion(
            sub_question=sub_question_dict["sub_question"],
            sub_question_nr="1_" + str(sub_question_nr),
            verified=False,
            answered=False,
            answer="",
        )

        follow_up_sub_question_dict[sub_question_nr] = follow_up_sub_question

    return FollowUpSubQuestionsUpdate(
        follow_up_sub_questions=follow_up_sub_question_dict,
        agent_refined_start_time=agent_refined_start_time,
    )


def ingest_follow_up_answers(
    state: AnswerQuestionOutput,
) -> FollowUpDecompAnswersUpdate:
    documents = []
    answer_results = state.get("answer_results", [])
    for answer_result in answer_results:
        documents.extend(answer_result.documents)
    return FollowUpDecompAnswersUpdate(
        # Deduping is done by the documents operator for the main graph
        # so we might not need to dedup here
        follow_up_documents=dedup_inference_sections(documents, []),
        follow_up_decomp_answer_results=answer_results,
    )


def logging_node(state: MainState) -> MainOutput:
    logger.info("---LOGGING NODE---")

    agent_start_time = state["agent_start_time"]
    agent_base_end_time = state["agent_base_end_time"]
    agent_refined_start_time = state["agent_refined_start_time"]
    agent_refined_end_time = state["agent_refined_end_time"]
    agent_end_time = max(agent_base_end_time, agent_refined_end_time)

    if agent_base_end_time:
        agent_base_duration = (agent_base_end_time - agent_start_time).total_seconds()
    else:
        agent_base_duration = None

    if agent_refined_end_time:
        agent_refined_duration = (
            agent_refined_end_time - agent_refined_start_time
        ).total_seconds()
    else:
        agent_refined_duration = None

    if agent_end_time:
        agent_full_duration = (agent_end_time - agent_start_time).total_seconds()
    else:
        agent_full_duration = None

    if agent_refined_duration:
        agent_type = "refined"
    else:
        agent_type = "base"

    agent_base_metrics = state["agent_base_metrics"]
    agent_refined_metrics = state["agent_refined_metrics"]

    combined_agent_metrics = CombinedAgentMetrics(
        timings=AgentTimings(
            base_duration_s=agent_base_duration,
            refined_duration_s=agent_refined_duration,
            full_duration_s=agent_full_duration,
        ),
        base_metrics=agent_base_metrics,
        refined_metrics=agent_refined_metrics,
        additional_metrics=AgentAdditionalMetrics(),
    )

    if state["config"].search_request.persona:
        persona_id = state["config"].search_request.persona.id
    else:
        persona_id = None

    if "user" in state:
        if state["user"]:
            user_id = state["user"].id
        else:
            user_id = None
    else:
        user_id = None

    # log the agent metrics
    log_agent_metrics(
        db_session=state["db_session"],
        user_id=user_id,
        persona_id=persona_id,
        agent_type=agent_type,
        start_time=agent_start_time,
        agent_metrics=combined_agent_metrics,
    )

    main_output = MainOutput()

    return main_output
