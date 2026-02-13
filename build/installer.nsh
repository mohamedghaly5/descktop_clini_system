!macro customInstall
  DetailPrint "Configuring Windows Firewall..."
  # Allow inbound on port 3000 and 8080
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Dental Flow Server" dir=in action=allow protocol=TCP localport=3000,8080'
!macroend

!macro customUnInstall
  DetailPrint "Removing Firewall Rules..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Dental Flow Server"'
!macroend
