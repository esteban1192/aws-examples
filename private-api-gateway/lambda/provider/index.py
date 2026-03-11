import json


def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "message": "Hello from the provider!",
            "path": event.get("path"),
            "method": event.get("httpMethod"),
        }),
    }
