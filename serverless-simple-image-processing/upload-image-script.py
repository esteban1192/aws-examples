import requests
import base64

def encode_image_to_base64(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

api_url = "https://2zt2gqv0rh.execute-api.us-east-1.amazonaws.com/prod/image"

file_name = 'tree-3097419_960_720.jpg'
image_path = f"test-images/{file_name}"

try:
    base64_image_content = encode_image_to_base64(image_path)
    
    payload = {
        "imageName": file_name,
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
