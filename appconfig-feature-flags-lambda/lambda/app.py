import json
import os
import urllib.request

APPCONFIG_PORT = 2772
APPLICATION = os.environ["APPCONFIG_APPLICATION"]
ENVIRONMENT = os.environ["APPCONFIG_ENVIRONMENT"]
CONFIGURATION = os.environ["APPCONFIG_CONFIGURATION"]

PRODUCTS = {
    "1": {
        "id": "1",
        "name": "Wireless Headphones",
        "price": 79.99,
        "description": "Noise-cancelling over-ear headphones with 30-hour battery life",
        "category": "Electronics",
        "rating": 4.5,
    },
    "2": {
        "id": "2",
        "name": "Mechanical Keyboard",
        "price": 129.99,
        "description": "RGB backlit mechanical keyboard with Cherry MX switches",
        "category": "Electronics",
        "rating": 4.8,
    },
    "3": {
        "id": "3",
        "name": "Running Shoes",
        "price": 109.99,
        "description": "Lightweight running shoes with responsive cushioning",
        "category": "Sports",
        "rating": 4.3,
    },
}


def get_feature_flags():
    url = (
        f"http://localhost:{APPCONFIG_PORT}"
        f"/applications/{APPLICATION}"
        f"/environments/{ENVIRONMENT}"
        f"/configurations/{CONFIGURATION}"
    )
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read())


def handler(event, context):
    product_id = event.get("pathParameters", {}).get("id")
    product = PRODUCTS.get(product_id)

    if not product:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Product not found"}),
        }

    flags = get_feature_flags()

    response_body = {
        "id": product["id"],
        "name": product["name"],
        "price": product["price"],
    }

    if flags.get("detailed_response", {}).get("enabled"):
        response_body["description"] = product["description"]
        response_body["category"] = product["category"]
        response_body["rating"] = product["rating"]

    discount = flags.get("discount_banner", {})
    if discount.get("enabled"):
        response_body["promotion"] = {
            "message": discount.get("message", ""),
            "discount_percent": discount.get("discount_percent", 0),
        }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(response_body),
    }
