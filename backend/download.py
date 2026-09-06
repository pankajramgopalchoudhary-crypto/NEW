"""Public ZIP download endpoint for the SmartSetupUAE codebase.

Streams /app/smartsetupuae-latest.zip with proper headers so the user can
just click an HTTPS link instead of using the file explorer.
"""
from __future__ import annotations
import os
import subprocess
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/api/download", tags=["download"])

ZIP_PATH = "/app/smartsetupuae-latest.zip"
SCRIPT_PATH = "/app/scripts/make_zip.sh"


@router.get("/latest")
async def download_latest():
    if not os.path.isfile(ZIP_PATH):
        # Build on-the-fly if missing
        if os.path.isfile(SCRIPT_PATH):
            subprocess.run(["bash", SCRIPT_PATH], check=False, timeout=60)
    if not os.path.isfile(ZIP_PATH):
        raise HTTPException(404, "Zip not yet generated. Run scripts/make_zip.sh.")
    size = os.path.getsize(ZIP_PATH)
    return FileResponse(
        ZIP_PATH,
        media_type="application/zip",
        filename="smartsetupuae-latest.zip",
        headers={"Content-Length": str(size), "Cache-Control": "no-store"},
    )


@router.post("/rebuild")
async def rebuild_zip():
    """Rebuild the zip on demand and return its size + sha-ish hint."""
    if not os.path.isfile(SCRIPT_PATH):
        raise HTTPException(500, "Build script missing.")
    proc = subprocess.run(["bash", SCRIPT_PATH], capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise HTTPException(500, proc.stderr[-400:])
    size = os.path.getsize(ZIP_PATH) if os.path.isfile(ZIP_PATH) else 0
    return JSONResponse({"ok": True, "bytes": size, "url": "/api/download/latest"})
