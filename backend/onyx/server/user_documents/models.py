from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from onyx.db.models import UserFile
from onyx.db.models import UserFolder


router = APIRouter()


class FileResponse(BaseModel):
    id: int
    name: str
    document_id: str
    folder_id: int | None = None

    @classmethod
    def from_model(cls, model: UserFile) -> "FileResponse":
        return cls(
            id=model.id,
            name=model.name,
            folder_id=model.folder_id,
            document_id=model.document_id,
        )


class FolderResponse(BaseModel):
    id: int
    name: str
    description: str
    files: List[FileResponse]

    @classmethod
    def from_model(cls, model: UserFolder) -> "FolderResponse":
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            files=[FileResponse.from_model(file) for file in model.files],
        )


class FolderDetailResponse(FolderResponse):
    files: List[FileResponse]


class MessageResponse(BaseModel):
    message: str


class FileSystemResponse(BaseModel):
    folders: list[FolderResponse]
    files: list[FileResponse]
