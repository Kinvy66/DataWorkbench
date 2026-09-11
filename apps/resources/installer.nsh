; Default remains per-user (LocalAppData). Program Files is a valid location
; but Windows blocks writes without elevation — that was the uninstallerIcon.ico error.
; If the user picks a protected folder while still in "current user" mode, request UAC
; before files are copied (customInstall runs too late).

!macro customPageAfterChangeDir
  Page custom dwElevateIfProtectedDir dwElevateIfProtectedDirLeave
!macroend

!macro customHeader
!ifndef BUILD_UNINSTALLER
Function dwElevateIfProtectedDir
  Push $R0
  Push $R1
  Push $R2
  Push $R8
  Push $R9

  StrCpy $R0 0

  StrLen $R1 "$PROGRAMFILES64"
  ${If} $R1 != 0
    StrCpy $R2 "$INSTDIR" $R1
    ${If} $R2 == "$PROGRAMFILES64"
      StrCpy $R0 1
    ${EndIf}
  ${EndIf}

  StrLen $R1 "$PROGRAMFILES"
  ${If} $R1 != 0
    StrCpy $R2 "$INSTDIR" $R1
    ${If} $R2 == "$PROGRAMFILES"
      StrCpy $R0 1
    ${EndIf}
  ${EndIf}

  ${If} $R0 == 0
    ClearErrors
    CreateDirectory "$INSTDIR"
    FileOpen $R9 "$INSTDIR\dw-write-test.tmp" w
    ${If} ${Errors}
      StrCpy $R0 1
    ${Else}
      FileClose $R9
      Delete "$INSTDIR\dw-write-test.tmp"
    ${EndIf}
  ${EndIf}

  ${If} $R0 == 0
    Pop $R9
    Pop $R8
    Pop $R2
    Pop $R1
    Pop $R0
    Abort
  ${EndIf}

  ${If} ${UAC_IsAdmin}
    StrCpy $R8 $INSTDIR
    !insertmacro setInstallModePerAllUsers
    StrCpy $INSTDIR $R8
    Pop $R9
    Pop $R8
    Pop $R2
    Pop $R1
    Pop $R0
    Abort
  ${EndIf}

  ShowWindow $HWNDPARENT ${SW_HIDE}
  !insertmacro UAC_RunElevated
  ${Switch} $0
    ${Case} 0
      ${If} $1 = 1
        Quit
      ${EndIf}
      ${If} $1 = 3
      ${OrIf} $2 = 0x666666
        MessageBox MB_OK|MB_ICONSTOP|MB_TOPMOST|MB_SETFOREGROUND "$(loginWithAdminAccount)"
      ${EndIf}
      ${Break}
    ${Case} 1223
      ${Break}
    ${Case} 1062
      MessageBox MB_OK|MB_ICONSTOP|MB_TOPMOST|MB_SETFOREGROUND "Logon service not running, aborting!"
      ${Break}
    ${Default}
      MessageBox MB_OK|MB_ICONSTOP|MB_TOPMOST|MB_SETFOREGROUND "Unable to elevate, error $0"
      ${Break}
  ${EndSwitch}

  ShowWindow $HWNDPARENT ${SW_SHOW}
  BringToFront

  Pop $R9
  Pop $R8
  Pop $R2
  Pop $R1
  Pop $R0

  !insertmacro MUI_HEADER_TEXT "Administrator permission required" "This folder cannot be written without administrator permission."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0u 0u 300u 80u "Installing under Program Files (or another protected folder) needs administrator permission. If you cancelled the Windows prompt, click Back and choose a folder in your user profile, or choose install for all users."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function dwElevateIfProtectedDirLeave
  Abort
FunctionEnd
!endif
!macroend
