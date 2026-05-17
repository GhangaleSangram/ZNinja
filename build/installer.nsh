; ZNinja NSIS Path Integration Script
; Uses electron-builder's built-in StrContains macro — no custom redefinition.

!macro customHeader
  Caption "ZNinja Setup"
!macroend

!macro customInit
  ; Silently kill the process if it is running to prevent "File in Use" errors
  nsExec::Exec 'taskkill /F /IM zninja.exe /T'
!macroend

!macro customUnInit
  ; Silently kill the process before uninstallation
  nsExec::Exec 'taskkill /F /IM zninja.exe /T'
!macroend

!macro customInstall
  DetailPrint "Updating System Path for ZNinja..."

  ReadRegStr $0 HKCU "Environment" "Path"

  ; Use the built-in StrContains macro provided by electron-builder
  ${StrContains} $1 "$INSTDIR" "$0"

  StrCmp $1 "" NotFound
    DetailPrint "ZNinja is already in the system PATH."
    Goto EndPathInstall

  NotFound:
    StrCmp $0 "" PathEmpty
      StrCpy $0 "$0;$INSTDIR"
      Goto PathSave
    PathEmpty:
      StrCpy $0 "$INSTDIR"
    PathSave:
      WriteRegStr HKCU "Environment" "Path" "$0"
      SendMessage 0xffff 0x001A 0 0 /TIMEOUT=5000
      DetailPrint "PATH updated successfully."

  EndPathInstall:

  ; Set output path to installation directory
  SetOutPath "$INSTDIR"

  DetailPrint "Creating custom ZNinja shortcuts..."
  ; Create shortcuts with specific icon
  CreateShortCut "$DESKTOP\ZNinja.lnk" "$INSTDIR\zninja.exe" "" "$INSTDIR\resources\zninja.ico" 0
  
  ; Create Start Menu folder and shortcut
  CreateDirectory "$SMPROGRAMS\ZNinja"
  CreateShortCut "$SMPROGRAMS\ZNinja\ZNinja.lnk" "$INSTDIR\zninja.exe" "" "$INSTDIR\resources\zninja.ico" 0
!macroend

!macro customUnInstall
  DetailPrint "Removing ZNinja from System Path..."

  ReadRegStr $0 HKCU "Environment" "Path"

  Push $0
  Push ";$INSTDIR"
  Call un.StrReplace
  Pop $0

  Push $0
  Push "$INSTDIR;"
  Call un.StrReplace
  Pop $0

  Push $0
  Push "$INSTDIR"
  Call un.StrReplace
  Pop $0

  WriteRegStr HKCU "Environment" "Path" "$0"
  SendMessage 0xffff 0x001A 0 0 /TIMEOUT=5000
  DetailPrint "PATH cleaned successfully."

  DetailPrint "Removing ZNinja shortcuts..."
  IfFileExists "$DESKTOP\ZNinja.lnk" 0 +2
    Delete "$DESKTOP\ZNinja.lnk"
    
  IfFileExists "$SMPROGRAMS\ZNinja\ZNinja.lnk" 0 +2
    Delete "$SMPROGRAMS\ZNinja\ZNinja.lnk"
    
  RMDir "$SMPROGRAMS\ZNinja"
!macroend

; --- UNINSTALLER HELPER (only compiled during uninstaller pass) ---

!ifdef BUILD_UNINSTALLER
Function un.StrReplace
  Exch $1 ; substring to remove
  Exch
  Exch $0 ; original string
  Push $2
  Push $3
  Push $4
  Push $5
  StrLen $2 $1
  StrCpy $5 ""
  un_loop:
    StrCpy $3 $0 $2
    StrCmp $3 "" un_done
    StrCmp $3 $1 un_found
    StrCpy $4 $0 1
    StrCpy $5 "$5$4"
    StrCpy $0 $0 "" 1
    Goto un_loop
  un_found:
    StrCpy $0 $0 "" $2
    Goto un_loop
  un_done:
    StrCpy $0 $5
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Exch $0
FunctionEnd
!endif
