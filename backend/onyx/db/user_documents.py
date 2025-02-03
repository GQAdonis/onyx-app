from typing import List

from fastapi import UploadFile
from sqlalchemy import and_
from sqlalchemy.orm import Session

from onyx.connectors.file.connector import _read_files_and_metadata
from onyx.db.models import Persona
from onyx.db.models import Persona__UserFile
from onyx.db.models import User
from onyx.db.models import UserFile
from onyx.db.models import UserFolder
from onyx.file_processing.extract_file_text import read_text_file
from onyx.llm.factory import get_default_llms
from onyx.natural_language_processing.utils import get_tokenizer
from onyx.server.documents.connector import upload_files


def create_user_files(
    files: List[UploadFile],
    folder_id: int | None,
    user: User,
    db_session: Session,
) -> list[UserFile]:
    print("user file endpoint")
    upload_response = upload_files(files, db_session)
    user_files = []

    context_files = _read_files_and_metadata(
        file_name=str(upload_response.file_paths[0]), db_session=db_session
    )

    content, _ = read_text_file(next(context_files)[1])
    llm, _ = get_default_llms()

    llm_tokenizer = get_tokenizer(
        model_name=llm.config.model_name,
        provider_type=llm.config.model_provider,
    )
    token_count = len(llm_tokenizer.encode(content))

    for file_path, file in zip(upload_response.file_paths, files):
        new_file = UserFile(
            user_id=user.id if user else None,
            folder_id=folder_id if folder_id != -1 else None,
            file_id=file_path,
            document_id=file_path,
            name=file.filename,
            token_count=token_count,
        )
        db_session.add(new_file)
        user_files.append(new_file)
    db_session.commit()
    return user_files


def get_user_files_from_folder(folder_id: int, db_session: Session) -> list[UserFile]:
    return db_session.query(UserFile).filter(UserFile.folder_id == folder_id).all()


def share_file_with_assistant(
    file_id: int, assistant_id: int, db_session: Session
) -> None:
    file = db_session.query(UserFile).filter(UserFile.id == file_id).first()
    assistant = db_session.query(Persona).filter(Persona.id == assistant_id).first()

    if file and assistant:
        file.assistants.append(assistant)
        db_session.commit()


def unshare_file_with_assistant(
    file_id: int, assistant_id: int, db_session: Session
) -> None:
    db_session.query(Persona__UserFile).filter(
        and_(
            Persona__UserFile.user_file_id == file_id,
            Persona__UserFile.persona_id == assistant_id,
        )
    ).delete()
    db_session.commit()


def share_folder_with_assistant(
    folder_id: int, assistant_id: int, db_session: Session
) -> None:
    folder = db_session.query(UserFolder).filter(UserFolder.id == folder_id).first()
    assistant = db_session.query(Persona).filter(Persona.id == assistant_id).first()

    if folder and assistant:
        for file in folder.files:
            share_file_with_assistant(file.id, assistant_id, db_session)


def unshare_folder_with_assistant(
    folder_id: int, assistant_id: int, db_session: Session
) -> None:
    folder = db_session.query(UserFolder).filter(UserFolder.id == folder_id).first()

    if folder:
        for file in folder.files:
            unshare_file_with_assistant(file.id, assistant_id, db_session)
