import logging
from logging.config import dictConfig
from app.core.config import get_settings


def configure_logging() -> None:
    level = get_settings().log_level.upper()
    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {"format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s"}
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler", "formatter": "default", "level": level}
        },
        "root": {"handlers": ["console"], "level": level},
    })
