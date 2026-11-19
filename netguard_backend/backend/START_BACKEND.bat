@echo off
title NETGUARD AI Backend
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    echo Python launcher "py" was not found.
    echo Install Python 3.10 or newer from https://www.python.org/downloads/
    echo During installation, enable "Add Python to PATH".
    pause
    exit /b 1
)

if not exist "venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    py -m venv venv
    if errorlevel 1 (
        echo Could not create the virtual environment.
        pause
        exit /b 1
    )
)

echo Installing or checking required packages...
"venv\Scripts\python.exe" -m pip install --upgrade pip
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Package installation failed. Check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo Starting NETGUARD AI API at http://127.0.0.1:8000
echo Keep this window open while using the frontend.
echo API documentation: http://127.0.0.1:8000/docs
echo.
"venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
