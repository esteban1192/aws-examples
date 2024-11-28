import requests
import base64

def encode_image_to_base64(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

api_url = "https://t4yh617h27.execute-api.us-east-1.amazonaws.com/prod/image" # Replace this with your own api gateway domain

image_path = "test-images/tree-736885_1280.jpg"

try:
    base64_image_content = encode_image_to_base64(image_path)
    payload = {
        "imageName": "example.jpg",  # Name of the image in S3
        "imageContent": base64_image_content
    }
    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(api_url, json=payload, headers=headers)

    print("Response Status Code:", response.status_code)
    print("Response JSON:", response.json())

except FileNotFoundError:
    print(f"File not found: {image_path}")
except Exception as e:
    print(f"An error occurred: {e}")
