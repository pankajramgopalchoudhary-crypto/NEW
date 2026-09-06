"""Passenger entry point for Hostinger cPanel "Setup Python App".

Hostinger's Setup Python App uses Phusion Passenger, which speaks WSGI by
default. FastAPI is an ASGI framework, so we wrap it using `a2wsgi` —
this lets Passenger serve regular request/response endpoints normally.

USAGE in Hostinger cPanel:
    • Application root:         public_html/api   (or wherever you upload `backend/`)
    • Application URL:          smartsetupuae.ae/api
    • Application startup file: passenger_wsgi.py
    • Application Entry point:  application
    • Python version:           3.10 or 3.11
    • Then click "Setup" → "Run Pip Install" against requirements.txt
"""
import os
import sys

# Ensure THIS folder is on the Python path so `server` (FastAPI) can be imported.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load .env so server.py sees MONGO_URL / SUPABASE_* / EMERGENT_LLM_KEY etc.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except Exception:
    pass

# Import the FastAPI ASGI app.
from server import app as asgi_app  # noqa: E402

# Bridge ASGI → WSGI so Passenger can serve it.
from a2wsgi import ASGIMiddleware  # noqa: E402

application = ASGIMiddleware(asgi_app)
