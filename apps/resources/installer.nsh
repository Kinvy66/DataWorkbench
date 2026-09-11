; Force per-user install. Writing to Program Files without elevation fails with
; "cannot open file for writing: uninstallerIcon.ico".
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\${APP_FILENAME}"
!macroend
