@echo off
chcp 65001 > nul
title Douyin Poster Wall Launcher

echo ===================================================
echo       Douyin Poster Wall - One-Click Start
echo ===================================================
echo.

:: 检查 python 是否可用
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python and add it to PATH.
    pause
    exit /b
)

echo [1] 直接打开海报墙 (本地数据)
echo [2] 登录抖音抓取数据 (慢速，需扫码)
echo.

set /p choice=请输入选项 (1/2): 

if "%choice%"=="1" (
    echo.
    echo [INFO] Starting server only...
    python "%~dp0run.py" server
) else if "%choice%"=="2" (
    echo.
    echo [INFO] Starting scraper and server...
    python "%~dp0run.py"
) else (
    echo.
    echo [ERROR] Invalid option. Defaulting to server only.
    python "%~dp0run.py" server
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application crashed or failed to start.
    pause
)
