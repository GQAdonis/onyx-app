from datetime import datetime
from typing import List

from pydantic import BaseModel

from onyx.db.models import UserFile
from onyx.db.models import UserFolder


class UserFileSnapshot(BaseModel):
    id: int
    name: str
    document_id: str
    folder_id: int | None = None
    user_id: int | None
    file_id: str
    created_at: datetime
    assistant_ids: List[int] = []  # List of assistant IDs

    @classmethod
    def from_model(cls, model: UserFile) -> "UserFileSnapshot":
        return cls(
            id=model.id,
            name=model.name,
            folder_id=model.folder_id,
            document_id=model.document_id,
            user_id=model.user_id,
            file_id=model.file_id,
            created_at=model.created_at,
            assistant_ids=[assistant.id for assistant in model.assistants],
        )


class UserFolderSnapshot(BaseModel):
    id: int
    name: str
    description: str
    files: List[UserFileSnapshot]
    created_at: datetime
    user_id: int | None
    assistant_ids: List[int] = []  # List of assistant IDs

    @classmethod
    def from_model(cls, model: UserFolder) -> "UserFolderSnapshot":
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            files=[UserFileSnapshot.from_model(file) for file in model.files],
            created_at=model.created_at,
            user_id=model.user_id,
            assistant_ids=[assistant.id for assistant in model.assistants],
        )


class FolderDetailResponse(UserFolderSnapshot):
    files: List[UserFileSnapshot]


class MessageResponse(BaseModel):
    message: str


class FileSystemResponse(BaseModel):
    folders: list[UserFolderSnapshot]
    files: list[UserFileSnapshot]
