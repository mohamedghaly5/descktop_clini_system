# Manual Check for Updates Implementation

## Status: Complete

### Changes
1. **Dependencies**:
   - Installed `electron-updater`.

2. **Backend (`electron/main.ts`)**:
   - Imported `autoUpdater`.
   - Setup `setupUpdater` function configured for manual control (`autoDownload = false`).
   - Added IPC Handlers: `check-for-update`, `download-update`, `quit-and-install`.
   - Added Event Listeners to forward status to frontend.

3. **Preload (`electron/preload.ts`)**:
   - Exposed methods to `window.api`:
     - `checkForUpdate()`
     - `downloadUpdate()`
     - `quitAndInstall()`
     - `onUpdateStatus(callback)`
     - `onUpdateProgress(callback)`

4. **Frontend**:
   - Created `src/components/UpdateCard.tsx`:
     - Manages state: `idle`, `checking`, `available`, `downloading`, `ready`, `latest`, `error`.
     - Displays appropriate buttons and progress bar.
     - Handles backend events.
   - Updated `src/pages/Settings.tsx`:
     - Imported and added `<UpdateCard />` to the General tab.

### Usage
- Go to **Settings > General**.
- Click "Check for Updates" (or "تحقق من التحديثات").
- If available, download will start upon confirmation.
- Once downloaded, click "Install & Restart".

### Note
- Ensure `electron-builder.yml` or `package.json` has the correct `publish` configuration (e.g., GitHub repo) for updates to actually find a server.
