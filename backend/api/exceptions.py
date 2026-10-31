from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Standardized API exception handler.
    Guarantees errors have a consistent shape:
    {
      "error": {
        "code": "...",
        "message": "...",
        "details": {...}
      }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "error": {
                "status_code": response.status_code,
                "message": "An error occurred while processing your request.",
                "details": response.data
            }
        }
        if response.status_code == 400:
            custom_data["error"]["code"] = "VALIDATION_ERROR"
            custom_data["error"]["message"] = "Invalid request payload."
        elif response.status_code == 401:
            custom_data["error"]["code"] = "AUTHENTICATION_FAILED"
            custom_data["error"]["message"] = "Authentication credentials were not provided or are invalid."
        elif response.status_code == 403:
            custom_data["error"]["code"] = "PERMISSION_DENIED"
            custom_data["error"]["message"] = "You do not have permission to perform this action."
        elif response.status_code == 404:
            custom_data["error"]["code"] = "NOT_FOUND"
            custom_data["error"]["message"] = "The requested resource was not found."
        elif response.status_code == 429:
            custom_data["error"]["code"] = "RATE_LIMIT_EXCEEDED"
            custom_data["error"]["message"] = "Too many requests. Please slow down."
        else:
            custom_data["error"]["code"] = "API_ERROR"

        response.data = custom_data
        return response

    # Catch-all for unhandled server errors (500)
    logger.exception("Unhandled server exception: %s", exc)
    return Response(
        {
            "error": {
                "status_code": 500,
                "code": "INTERNAL_SERVER_ERROR",
                "message": "A critical server error occurred. The incident has been recorded."
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
