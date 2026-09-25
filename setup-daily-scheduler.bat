@echo off
echo ========================================================
echo Installing PageAlerts into Windows Task Scheduler...
echo ========================================================
schtasks /create /tn "PageAlerts Daily Check" /tr "\"%~dp0run-check.bat\"" /sc daily /st 08:00 /f
echo.
if %errorlevel% equ 0 (
  echo [SUCCESS] PageAlerts will now run automatically every morning at 08:00 AM!
  echo You do not need to keep any terminal or browser window open.
) else (
  echo [INFO] If permission was denied, right-click this file and select "Run as administrator".
)
echo.
pause
