import json
import os

# Applicable for OIDC Auth
OPENID_CONFIG_URL = os.environ.get("OPENID_CONFIG_URL", "")

# Applicable for SAML Auth
SAML_CONF_DIR = os.environ.get("SAML_CONF_DIR") or "/app/ee/danswer/configs/saml_config"


#####
# Auto Permission Sync
#####
# In seconds, default is 5 minutes
CONFLUENCE_PERMISSION_GROUP_SYNC_FREQUENCY = int(
    os.environ.get("CONFLUENCE_PERMISSION_GROUP_SYNC_FREQUENCY") or 5 * 60
)
# In seconds, default is 5 minutes
CONFLUENCE_PERMISSION_DOC_SYNC_FREQUENCY = int(
    os.environ.get("CONFLUENCE_PERMISSION_DOC_SYNC_FREQUENCY") or 5 * 60
)
NUM_PERMISSION_WORKERS = int(os.environ.get("NUM_PERMISSION_WORKERS") or 2)


STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE")

OPENAI_DEFAULT_API_KEY = os.environ.get("OPENAI_DEFAULT_API_KEY")
ANTHROPIC_DEFAULT_API_KEY = os.environ.get("ANTHROPIC_DEFAULT_API_KEY")
COHERE_DEFAULT_API_KEY = os.environ.get("COHERE_DEFAULT_API_KEY")

# JWT Public Key URL
JWT_PUBLIC_KEY_URL: str | None = os.getenv("JWT_PUBLIC_KEY_URL", None)


# Super Users
SUPER_USERS = json.loads(os.environ.get("SUPER_USERS", '["pablo@danswer.ai"]'))
SUPER_CLOUD_API_KEY = os.environ.get("SUPER_CLOUD_API_KEY", "api_key")
