import json
import os
from urllib.request import Request, urlopen
from urllib.error import URLError


def handler(event, context):
    api_url = os.environ["API_URL"]

    try:
        req = Request(api_url, method="GET")
        with urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            return {
                "statusCode": resp.status,
                "providerResponse": json.loads(body),
            }
    except URLError as e:
        return {
            "statusCode": 502,
            "error": str(e),
        }
