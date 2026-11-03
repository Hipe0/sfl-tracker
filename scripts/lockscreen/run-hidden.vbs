' Run update-lockscreen.ps1 without a window (called by Task Scheduler)
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
extra = ""
For Each a In WScript.Arguments
  extra = extra & " " & a
Next
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\update-lockscreen.ps1""" & extra, 0, True
