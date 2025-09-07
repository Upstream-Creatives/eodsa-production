@echo off
echo 🚀 Starting Local Development Testing
echo.

echo 📂 Starting Next.js app...
start "Next.js App" cmd /k "cd /d %~dp0.. && npm run dev"

echo.
echo ⏳ Waiting for app to start (10 seconds)...
timeout /t 10 /nobreak > nul

echo.
echo 🌐 Your app should now be running at: http://localhost:3000
echo.
echo 📋 Next steps:
echo 1. Download ngrok from: https://ngrok.com/download
echo 2. Extract ngrok.exe to a folder
echo 3. Open new cmd window in that folder
echo 4. Run: ngrok http 3000
echo 5. Copy the https URL from ngrok
echo 6. Update .env.local with that URL
echo.
pause
