@rem Il CLI col runtime dell'editor (Code.exe in modalita' Node), quando su Windows non c'e' un node nel PATH:
@rem lanciato da qui ha una console a cui agganciarsi, e il suo output arriva al terminale del
@rem task (vedi cliLaunch in syncCommand.mjs). VT_EDITOR_EXE ed ELECTRON_RUN_AS_NODE li mette il task.
@"%VT_EDITOR_EXE%" %*
@exit /b %errorlevel%
