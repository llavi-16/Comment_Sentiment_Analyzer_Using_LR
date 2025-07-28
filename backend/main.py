import os
import re
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv
from joblib import dump, load
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import nltk

# --- Initial Setup ---
load_dotenv()
logging.basicConfig(level=logging.INFO)
app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load API Key ---
API_KEY = os.getenv("YOUTUBE_API_KEY")
if not API_KEY:
    raise ValueError("YouTube API Key is missing. Please set it in your .env file.")

# --- Train and Load a Lightweight ML Model ---
MODEL_FILE = "sentiment_model.joblib"
sentiment_pipeline = None

try:
    # Check if a pre-trained model exists
    sentiment_pipeline = load(MODEL_FILE)
    logging.info("Loaded pre-trained sentiment model from file.")
except FileNotFoundError:
    logging.info("Pre-trained model not found. Training a new model...")
    try:
        # Download the dataset needed for training
        logging.info("Downloading 'movie_reviews' dataset for NLTK...")
        nltk.download('movie_reviews')
        from nltk.corpus import movie_reviews # Import after download
        logging.info("Download complete.")

        # --- CORRECTED DATA LOADING LOGIC ---
        # Get the list of all file IDs (e.g., 'neg/cv000_29416.txt')
        fileids = movie_reviews.fileids()

        # Load the raw text content for each fileid. This ensures a 1-to-1 match.
        documents = [movie_reviews.raw(fileid) for fileid in fileids]
        
        # Load the category ('pos' or 'neg') for each corresponding fileid.
        sentiments = [movie_reviews.categories(fileid)[0] for fileid in fileids]

        # Now, len(documents) will be 2000, and len(sentiments) will also be 2000. They match!

        # Map 'pos'/'neg' labels to 1/0 for the model
        y = [1 if s == 'pos' else 0 for s in sentiments]

        # Create a scikit-learn pipeline
        sentiment_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(stop_words='english', max_features=2000, ngram_range=(1,2))),
            ('clf', LogisticRegression(solver='liblinear'))
        ])

        # Train the model
        logging.info("Training the model... This might take a moment.")
        sentiment_pipeline.fit(documents, y)

        # Save the trained model to a file for future use
        dump(sentiment_pipeline, MODEL_FILE)
        logging.info("New model trained and saved as sentiment_model.joblib.")

    except Exception as e:
        logging.error(f"Failed to train or save the model: {e}")
        sentiment_pipeline = None # Ensure it's None if training fails


# --- Pydantic Model for Request Validation ---
class VideoRequest(BaseModel):
    url: str

# --- Helper Functions ---
def extract_video_id(url: str) -> str | None:
    regex = r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
    match = re.search(regex, url)
    return match.group(1) if match else None

def get_video_comments(video_id: str, max_results=100) -> list:
    try:
        youtube_service = build('youtube', 'v3', developerKey=API_KEY)
        request = youtube_service.commentThreads().list(
            part='snippet',
            videoId=video_id,
            maxResults=max_results,
            textFormat='plainText'
        )
        response = request.execute()
        return [item['snippet']['topLevelComment']['snippet']['textDisplay'] for item in response.get('items', [])]
    except HttpError as e:
        if 'commentsDisabled' in str(e.content):
            raise HTTPException(status_code=403, detail="Comments are disabled for this video.")
        else:
            raise HTTPException(status_code=500, detail="Failed to fetch comments. Check URL or API key.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An internal server error occurred.")

# --- API Endpoint ---
@app.post("/analyze")
async def analyze_video_comments(request: VideoRequest):
    if not sentiment_pipeline:
        raise HTTPException(status_code=503, detail="Sentiment model is not available.")

    video_id = extract_video_id(request.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid or unsupported YouTube URL.")

    comments = get_video_comments(video_id)
    if not comments:
        return {"positive": 0, "negative": 0}

    sentiment_counts = {"positive": 0, "negative": 0}

    try:
        predictions = sentiment_pipeline.predict(comments)
        for pred in predictions:
            if pred == 1:
                sentiment_counts["positive"] += 1
            else:
                sentiment_counts["negative"] += 1
    except Exception as e:
        logging.error(f"Error during prediction: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze comments.")

    return sentiment_counts

@app.get("/")
def read_root():
    return {"status": "Sentiment Analyzer API is running."}
