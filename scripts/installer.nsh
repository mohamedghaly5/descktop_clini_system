!include "MUI2.nsh"

!macro customInstall
  DetailPrint "Adding Firewall Rule for Dental Flow Server..."
  nsExec::Exec 'netsh advfirewall firewall add rule name="Dental Flow Server" dir=in action=allow protocol=TCP localport=3000 profile=any'
!macroend

!macro customUnInstall
  DetailPrint "Removing Firewall Rule for Dental Flow Server..."
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Dental Flow Server" protocol=TCP localport=3000'
!macroend
