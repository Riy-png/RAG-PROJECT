import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env
load_dotenv()

# Initialize the Gemini client using the API key from the environment
client = genai.Client()

try:
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="Say 'API connection successful!' if you can read this.",
    )
    print("Test Result:", response.text)
except Exception as e:
    print("Connection failed with error:", e)