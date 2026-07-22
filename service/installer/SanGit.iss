; SanGit installer (Inno Setup 6). Per-user install, no admin/UAC.
; Built by build_installer.py, which passes the version:
;     ISCC /DAppVersion=0.1.0 installer\SanGit.iss
; Output: ../dist/SanGitSetup.exe

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
; Stable AppId — never change it, or upgrades/uninstall entries break.
AppId={{A7F3C2E1-9B4D-4E6A-8C1F-2D5B6E7A8F90}
AppName=SanGit
AppVersion={#AppVersion}
AppPublisher=SanGit
AppPublisherURL=https://san-git.vercel.app
DefaultDirName={localappdata}\Programs\SanGit
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=SanGitSetup
SetupIconFile=..\assets\logoapp.ico
UninstallDisplayIcon={app}\SanGit.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Detect a running SanGit (main.py's single-instance mutex) and ask to close it
; before overwriting the exe.
AppMutex=SanGit.Service.Mutex

[Tasks]
Name: "startatlogin"; Description: "Start SanGit when I sign in"; GroupDescription: "Startup:"
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "..\dist\SanGit.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SanGit"; Filename: "{app}\SanGit.exe"
Name: "{autodesktop}\SanGit"; Filename: "{app}\SanGit.exe"; Tasks: desktopicon

[Registry]
; Launch at login (per-user Run key). Removed on uninstall; only if opted in.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
    ValueType: string; ValueName: "SanGit"; ValueData: """{app}\SanGit.exe"""; \
    Flags: uninsdeletevalue; Tasks: startatlogin

[Run]
Filename: "{app}\SanGit.exe"; Description: "Launch SanGit now"; \
    Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    if DirExists(ExpandConstant('{userappdata}\SanGit')) then
    begin
      if MsgBox('Also remove your SanGit settings and any queued uploads/renders?'
                + #13#10 + 'Choose No to keep them for a future reinstall.',
                mbConfirmation, MB_YESNO) = IDYES then
        DelTree(ExpandConstant('{userappdata}\SanGit'), True, True, True);
    end;
  end;
end;
