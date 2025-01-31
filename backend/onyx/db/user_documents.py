from typing import List

from fastapi import UploadFile
from sqlalchemy import and_
from sqlalchemy.orm import Session

from onyx.db.models import Persona
from onyx.db.models import Persona__UserFile
from onyx.db.models import User
from onyx.db.models import UserFile
from onyx.db.models import UserFolder
from onyx.server.documents.connector import upload_files
from onyx.server.documents.models import FileUploadResponse


def create_user_files(
    files: List[UploadFile],
    folder_id: int | None,
    user: User,
    db_session: Session,
) -> FileUploadResponse:
    upload_response = upload_files(files, db_session)
    for file_path, file in zip(upload_response.file_paths, files):
        new_file = UserFile(
            user_id=user.id if user else None,
            folder_id=folder_id if folder_id != -1 else None,
            file_id=file_path,
            document_id=file_path,
            name=file.filename,
        )
        db_session.add(new_file)
    db_session.commit()
    return upload_response


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
