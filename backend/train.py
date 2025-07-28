import nltk
from nltk.corpus import movie_reviews
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from joblib import dump
import logging

logging.basicConfig(level=logging.INFO)

def train_and_save_model():
    """
    Downloads NLTK data, trains a sentiment model, and saves it to a file.
    """
    try:
        logging.info("Downloading 'movie_reviews' dataset...")
        nltk.download('movie_reviews')
        logging.info("Download complete.")

        # Load data
        fileids = movie_reviews.fileids()
        documents = [movie_reviews.raw(fileid) for fileid in fileids]
        sentiments = [1 if movie_reviews.categories(fileid)[0] == 'pos' else 0 for fileid in fileids]

        # Define the model pipeline
        model_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(stop_words='english', max_features=2000, ngram_range=(1,2))),
            ('clf', LogisticRegression(solver='liblinear'))
        ])

        # Train the model
        logging.info("Training the sentiment model...")
        model_pipeline.fit(documents, sentiments)

        # Save the trained model
        dump(model_pipeline, 'sentiment_model.joblib')
        logging.info("Model training complete and saved as 'sentiment_model.joblib'.")

    except Exception as e:
        logging.error(f"An error occurred during model training: {e}")
        # Exit with an error code to fail the build if training doesn't work
        exit(1)

if __name__ == '__main__':
    train_and_save_model()
