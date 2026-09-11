import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "pramaan_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=900,  # 15 minutes max for full gazette extraction & embeddings
)

# Automated Daily Crawl Schedule (Runs every morning at 06:00 AM IST)
celery_app.conf.beat_schedule = {
    "daily-official-gazette-crawl": {
        "task": "tasks.run_daily_gazette_crawl",
        "schedule": crontab(hour=6, minute=0),  # 6:00 AM daily
        "args": ()
    }
}
