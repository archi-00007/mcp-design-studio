@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo  =============================================
echo   MCP Design Studio - build release file
echo  =============================================
echo.

call npm run release
set CODE=%ERRORLEVEL%

echo.
if not "%CODE%"=="0" (
  echo  [FAILED]  Build failed. Please read the messages above.
) else (
  echo  [DONE]    release\mcp-design-studio.html
  echo            Double-click it, or send it to others.
)
echo.
pause
endlocal
exit /b %CODE%
