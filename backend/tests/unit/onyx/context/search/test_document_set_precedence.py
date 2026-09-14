"""Precedence of the document-set scope: request > session > persona.

`_build_index_filters` itself is a TWO-tier merge — request filters or the
persona's sets (`pipeline.py:86-90`). The session tier is folded in upstream by
`_with_session_document_set_scope` (`process_message.py`), which rewrites the
request filters before they ever reach the pipeline. These tests pin both halves
and the seam between them, because the operator decision for this phase was to
leave the pipeline merge semantics alone.

The DB is stubbed, following `test_forced_document_set.py`: the ACL path
(`filter_document_set_names_by_user_access`) needs a real session and is covered
by an external-dependency test instead.
"""

from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

import onyx.chat.process_message as process_message
import onyx.context.search.pipeline as pipeline
from onyx.context.search.models import BaseFilters, IndexFilters
from onyx.db.models import User

_DB = cast(Session, object())


def _build(
    *,
    user_provided: BaseFilters | None,
    persona_sets: list[str] | None,
) -> IndexFilters:
    return pipeline._build_index_filters(
        user_provided_filters=user_provided,
        user=cast(User, SimpleNamespace(is_anonymous=False)),
        project_id_filter=None,
        persona_id_filter=None,
        persona_document_sets=persona_sets,
        persona_time_cutoff=None,
        db_session=None,
        bypass_acl=True,
    )


def test_request_scope_wins_over_persona() -> None:
    filters = _build(
        user_provided=BaseFilters(document_set=["Requested"]),
        persona_sets=["PersonaSet"],
    )
    assert filters.document_set == ["Requested"]


def test_persona_scope_used_when_request_carries_none() -> None:
    filters = _build(user_provided=BaseFilters(), persona_sets=["PersonaSet"])
    assert filters.document_set == ["PersonaSet"]


def test_empty_persona_scope_searches_unrestricted() -> None:
    """G4: an unscoped search is not narrowed by document set at all.

    Pinned deliberately. This is the silent fall-through the phase's logging
    change makes audible; it is not an error, and nothing should start
    treating it as one without an explicit decision.
    """
    filters = _build(user_provided=BaseFilters(), persona_sets=[])
    assert not filters.document_set


def test_empty_request_list_is_not_treated_as_absent() -> None:
    """`[]` is a scope that matches nothing, not "no scope".

    The merge tests `is not None`, so an explicitly empty request list must NOT
    fall back to the persona's sets — otherwise clearing a scope would silently
    widen the search instead of narrowing it.
    """
    filters = _build(
        user_provided=BaseFilters(document_set=[]), persona_sets=["PersonaSet"]
    )
    assert filters.document_set == []


def _session_scope(
    monkeypatch: pytest.MonkeyPatch,
    *,
    request_filters: BaseFilters | None,
    stored: list[str],
) -> BaseFilters | None:
    """Call the session-tier fold with the DB read stubbed."""
    monkeypatch.setattr(
        process_message,
        "get_chat_session_document_set_names",
        # Called with keywords (db_session=, chat_session_id=), so accept any
        # rather than naming args the stub never reads.
        lambda **_kwargs: stored,
    )

    class _NullSession:
        def __enter__(self) -> Session:
            return _DB

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(
        process_message, "get_session_with_current_tenant", lambda: _NullSession()
    )
    return process_message._with_session_document_set_scope(
        new_msg_req_filters=request_filters, chat_session_id=uuid4()
    )


def test_session_scope_fills_in_when_request_has_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    merged = _session_scope(
        monkeypatch, request_filters=BaseFilters(), stored=["SessionSet"]
    )
    assert merged is not None
    assert merged.document_set == ["SessionSet"]


def test_request_scope_wins_over_session(monkeypatch: pytest.MonkeyPatch) -> None:
    merged = _session_scope(
        monkeypatch,
        request_filters=BaseFilters(document_set=["Requested"]),
        stored=["SessionSet"],
    )
    assert merged is not None
    assert merged.document_set == ["Requested"]


def test_absent_session_scope_leaves_persona_fallback_intact(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No stored scope must return the request filters untouched, so the
    pipeline's persona fallback still applies downstream."""
    request_filters = BaseFilters()
    merged = _session_scope(monkeypatch, request_filters=request_filters, stored=[])
    assert merged is request_filters

    filters = _build(user_provided=merged, persona_sets=["PersonaSet"])
    assert filters.document_set == ["PersonaSet"]


def test_session_scope_applies_when_request_filters_are_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A message with no filters object at all still picks up the session scope."""
    merged = _session_scope(monkeypatch, request_filters=None, stored=["SessionSet"])
    assert merged is not None
    assert merged.document_set == ["SessionSet"]


def test_full_chain_session_beats_persona_end_to_end(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The seam: fold the session tier, then run the real pipeline merge."""
    merged = _session_scope(
        monkeypatch, request_filters=BaseFilters(), stored=["SessionSet"]
    )
    filters = _build(user_provided=merged, persona_sets=["PersonaSet"])
    assert filters.document_set == ["SessionSet"]
