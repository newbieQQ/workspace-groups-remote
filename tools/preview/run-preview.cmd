@echo off
rem Run the isolated Remote-SSH settings preview screenshots from a NORMAL user
rem terminal (not from inside a constrained / Low-integrity sandbox job).
rem Chromium cannot start its internal named-pipe IPC inside that sandbox.
setlocal
cd /d "%~dp0..\.."
"C:\Users\qyh15\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" "tools\preview-rssh-settings.mjs" %*
exit /b %ERRORLEVEL%
