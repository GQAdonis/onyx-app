from danswer.db_setup import setup_postgres
from danswer.db.engine import get_sqlalchemy_engine
from typing import cast
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from danswer.chat.load_yamls import load_chat_yamls
from danswer.auth.users import create_user_session
from danswer.auth.users import current_admin_user
from danswer.auth.users import current_user
from danswer.auth.users import get_user_manager
from danswer.auth.users import is_user_admin
from danswer.auth.users import UserManager
from danswer.auth.users import verify_sso_token
from danswer.configs.app_configs import SESSION_EXPIRE_TIME_SECONDS
from danswer.configs.app_configs import WEB_DOMAIN
from danswer.configs.constants import KV_REINDEX_KEY
from danswer.configs.constants import NotificationType
from danswer.db.engine import get_session

from danswer.db.models import User
from danswer.db.notification import create_notification
from danswer.db.notification import dismiss_all_notifications
from danswer.db.notification import dismiss_notification
from danswer.db.notification import get_notification_by_id
from danswer.db.notification import get_notifications
from danswer.db.notification import update_notification_last_shown
from danswer.dynamic_configs.factory import get_dynamic_config_store
from danswer.dynamic_configs.interface import ConfigNotFoundError
from danswer.server.settings.models import Notification
from danswer.server.settings.models import Settings
from danswer.server.settings.models import UserSettings
from danswer.server.settings.store import load_settings
from danswer.server.settings.store import store_settings
from danswer.utils.logger import setup_logger
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from danswer.db.engine import get_async_session
import subprocess
import contextlib
from sqlalchemy import text

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

admin_router = APIRouter(prefix="/admin/settings")
basic_router = APIRouter(prefix="/settings")


logger = setup_logger()


def run_alembic_migrations(schema_name: str) -> None:
    # alembic -x "schema=tenant1,create_schema=true" upgrade head

    logger.info(f"Starting Alembic migrations for schema: {schema_name}")
    command = [
        "alembic",
        "-x",
        f"schema={schema_name},create_schema=true",
        "upgrade",
        "head"
    ]
    print("SHOULD BE RUNNING MIGRATION")
    print(schema_name)
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"Alembic migration failed for schema {schema_name}: {result.stderr}")
        raise Exception(f"Migration failed for schema {schema_name}")
    logger.info(f"Alembic migrations completed successfully for schema: {schema_name}")


async def check_schema_exists(tenant_id: str) -> bool:
    logger.info(f"Checking if schema exists for tenant: {tenant_id}")
    get_async_session_context = contextlib.asynccontextmanager(
        get_async_session
    )
    async with get_async_session_context() as session:
        result = await session.execute(
            text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema_name"),
            {"schema_name": tenant_id}
        )
        schema = result.scalar()
        exists = schema is not None
        logger.info(f"Schema for tenant {tenant_id} exists: {exists}")
        return exists

async def create_tenant_schema(tenant_id: str) -> None:
    logger.info(f"Creating schema for tenant: {tenant_id}")
    # Create the schema
    get_async_session_context = contextlib.asynccontextmanager(
        get_async_session
    )

    # Run migrations for the new schema
    logger.info(f"Running migrations for tenant: {tenant_id}")
    run_alembic_migrations(tenant_id)

    async with get_async_session_context() as session:
        await session.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{tenant_id}"'))
        await session.commit()
        logger.info(f"Schema created for tenant: {tenant_id}")

    with Session(get_sqlalchemy_engine(schema=tenant_id)) as db_session:
        try:
            setup_postgres(db_session)
        except SQLAlchemyError as e:
            logger.error(f"Error while loading chat YAMLs for tenant {tenant_id}: {str(e)}")
            raise
        finally:
            db_session.execute(text('SET search_path TO "public"'))

        # db_session.execute(text(f'SET search_path TO "public"'))

    logger.info(f"Migrations completed for tenant: {tenant_id}")


@basic_router.post("/auth/sso-callback") 
async def sso_callback(
    response: Response,
    sso_token: str = Query(..., alias="sso_token"),
    user_manager: UserManager = Depends(get_user_manager),
) -> JSONResponse:
    logger.info("SSO callback initiated")
    payload = verify_sso_token(sso_token)
    logger.info(f"SSO token verified for email: {payload['email']}")

    user = await user_manager.sso_authenticate(
        payload["email"], payload["user_id"], payload["tenant_id"]
    )
    logger.info(f"User authenticated: {user.email}")

    tenant_id = payload["tenant_id"]
    logger.info(f"Checking schema for tenant: {tenant_id}")
    # Check if tenant schema exists


    schema_exists = await check_schema_exists(tenant_id)
    if True:
        logger.info(f"Schema does not exist for tenant: {tenant_id}. Creating...")
        # Create schema and run migrations
        await create_tenant_schema(tenant_id)
    else:
        logger.info(f"Schema already exists for tenant: {tenant_id}")



    session_token = await create_user_session(user, payload["tenant_id"])
    logger.info(f"Session token created for user: {user.email}")

    # Set the session cookie with proper flags
    response.set_cookie(
        key="fastapiusersauth",
        value=session_token,
        max_age=SESSION_EXPIRE_TIME_SECONDS,
        expires=SESSION_EXPIRE_TIME_SECONDS,
        path="/",
        domain=WEB_DOMAIN.split("://")[-1],
        secure=True,
        httponly=True,
        samesite="lax",
    )
    logger.info("Session cookie set")

    logger.info("SSO callback completed successfully")
    return JSONResponse(
        content={"message": "Authentication successful"},
        status_code=200
    )



# @basic_router.post("/auth/sso-callback")
# async def sso_callback(
#     sso_token: str = Query(..., alias="sso_token"),
#     strategy: Strategy = Depends(get_database_strategy),
#     user_manager: UserManager = Depends(get_user_manager),
# ):
#     payload = verify_sso_token(sso_token)

#     user = await user_manager.sso_authenticate(
#         payload["email"], payload["user_id"], payload["tenant_id"]
#     )

#     session_token = await create_user_session(user, payload["tenant_id"], strategy)
#     logger.info(f"Session token created: {session_token[:10]}...")

#     return {
#         "session_token": session_token,
#         "max_age": SESSION_EXPIRE_TIME_SECONDS,
#         "domain": WEB_DOMAIN.split("://")[-1],
#     }


@admin_router.put("")
def put_settings(
    settings: Settings, _: User | None = Depends(current_admin_user)
) -> None:
    try:
        settings.check_validity()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    store_settings(settings)


@basic_router.get("")
def fetch_settings(
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> UserSettings:
    """Settings and notifications are stuffed into this single endpoint to reduce number of
    Postgres calls"""
    general_settings = load_settings()
    user_notifications = get_user_notifications(user, db_session)

    try:
        kv_store = get_dynamic_config_store()
        needs_reindexing = cast(bool, kv_store.load(KV_REINDEX_KEY))
    except ConfigNotFoundError:
        needs_reindexing = False

    return UserSettings(
        **general_settings.model_dump(),
        notifications=user_notifications,
        needs_reindexing=needs_reindexing,
    )


@basic_router.post("/notifications/{notification_id}/dismiss")
def dismiss_notification_endpoint(
    notification_id: int,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    try:
        notification = get_notification_by_id(notification_id, user, db_session)
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Not authorized to dismiss this notification"
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Notification not found")

    dismiss_notification(notification, db_session)


def get_user_notifications(
    user: User | None, db_session: Session
) -> list[Notification]:
    return cast(list[Notification], [])
    """Get notifications for the user, currently the logic is very specific to the reindexing flag"""
    is_admin = is_user_admin(user)
    if not is_admin:
        # Reindexing flag should only be shown to admins, basic users can't trigger it anyway
        return []

    kv_store = get_dynamic_config_store()
    try:
        needs_index = cast(bool, kv_store.load(KV_REINDEX_KEY))
        if not needs_index:
            dismiss_all_notifications(
                notif_type=NotificationType.REINDEX, db_session=db_session
            )
            return []
    except ConfigNotFoundError:
        # If something goes wrong and the flag is gone, better to not start a reindexing
        # it's a heavyweight long running job and maybe this flag is cleaned up later
        logger.warning("Could not find reindex flag")
        return []

    try:
        # Need a transaction in order to prevent under-counting current notifications
        db_session.begin()

        reindex_notifs = get_notifications(
            user=user, notif_type=NotificationType.REINDEX, db_session=db_session
        )

        if not reindex_notifs:
            notif = create_notification(
                user=user,
                notif_type=NotificationType.REINDEX,
                db_session=db_session,
            )
            db_session.flush()
            db_session.commit()
            return [Notification.from_model(notif)]

        if len(reindex_notifs) > 1:
            logger.error("User has multiple reindex notifications")

        reindex_notif = reindex_notifs[0]
        update_notification_last_shown(
            notification=reindex_notif, db_session=db_session
        )

        db_session.commit()
        return [Notification.from_model(reindex_notif)]
    except SQLAlchemyError:
        logger.exception("Error while processing notifications")
        db_session.rollback()
        return []
