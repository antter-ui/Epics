@echo off
title Push MediCare Connect to GitHub
cd /d "%~dp0"
echo ========================================================
echo Connecting and Pushing to https://github.com/antter-ui/Epics.git
echo ========================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Successfully pushed all code to https://github.com/antter-ui/Epics.git!
) else (
    echo [ERROR] Push failed. If prompted, please complete the sign-in in your browser.
)
echo.
pause
