import contextvars


# Context variable for the current tenant id
CURRENT_TENANT_ID_CONTEXTVAR = contextvars.ContextVar("current_tenant_id", default=None)


"""Utils related to contextvars"""


def current_tenant_id() -> str:
    tenant_id = CURRENT_TENANT_ID_CONTEXTVAR.get()
    if tenant_id is None:
        raise RuntimeError("Tenant ID is not set. This should never happen.")
    return tenant_id
