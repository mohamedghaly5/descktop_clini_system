# Project Tech Memory: Dental Flow

## 1. Project Overview
**Name**: Dental Flow  
**Description**: A comprehensive Desktop Dental Clinic Management System tailored for clinics to manage patients, appointments, financials, and inventory.  
**Version**: 1.0.6  

## 2. Technology Stack

### Core
- **Runtime**: Electron (v39) - Cross-platform desktop application framework.
- **Frontend Framework**: React (v18) with TypeScript.
- **Build Tool**: Vite (v5).
- **Language**: TypeScript (Strict typing enforced).

### UI & Styling
- **Styling**: Tailwind CSS (v3.4).
- **Components**: Radix UI primitives (via `shadcn/ui` pattern).
- **Icons**: Lucide React.
- **Animations**: `tailwindcss-animate`.

### State & Data Management
- **Local Database**: SQLite (via `better-sqlite3`).
- **Remote/API**: Express (internal local server for client connections).
- **State Management**: React Query (`@tanstack/react-query`) for server state, React Context for global app state (Auth, Language, Settings).
- **Routing**: React Router DOM (v6).
- **Validation**: Zod + React Hook Form.

### External Services
- **Supabase**: Used for license verification and potentially cloud backups/sync.
- **Google APIs**: Likely for Google Drive backups (implied by `googleapis` dependency).

## 3. Architecture & Design Patterns

### Hybrid Client/Server Model
The application is designed to function in two distinct modes, handled dynamically at runtime:
1.  **Server/Local Mode**:
    - Acts as the primary instance.
    - Direct access to the local SQLite database via IPC.
    - Hosts an Express API server (port 3000) to allow other clients to connect.
    - Handles background tasks like Backups and Database Initialization.
2.  **Client Mode**:
    - connects to a standard running Server instance.
    - Does not initialize a local database.
    - Routes all data requests via HTTP (Axios) to the Server's API endpoints.

### Data Access Layer (`src/services/db.ts`)
A central abstraction layer handles all data operations. It creates a unified interface that transparently switches strategies based on the current mode:
- **If Local**: Calls `window.electron.ipcRenderer.invoke(...)`.
- **If Client**: Calls `axios.get/post(...)` to the configured `serverUrl`.

### Electron Main Process (`electron/`)
- **`main.ts`**: Entry point. Sets up windows, auto-updates, and decides whether to start the Local Server.
- **`handlers.ts`**: Registers IPC handlers that bridge the Renderer to the Node.js environment (DB, File System).
- **`server/api.ts`**: (Implied) The Express app that exposes database functions as REST endpoints for Client Mode.
- **`backupService.ts`**: Manages local and cloud backups.

## 4. Key Modules & Features

### Patient Management
- **Profile**: Comprehensive details including medical history, notes, and city.
- **Attachments**: Support for X-rays and documents (stored locally or via file URL).
- **Soft Delete**: Patients can be marked as deleted without physical removal, preserving historical data.
- **Stats**: Calculated fields for age, balance, etc.

### Appointments
- **Scheduling**: Date/Time slot booking.
- **Status**: Track attendance (Attended, Cancelled, etc.).
- **Integration**: Linked directly to Patients and Services.

### Financials
- **Treatment Cases**: Grouping of services/procedures for a patient.
- **Invoices**: Tracking payments and remaining balances.
- **Expenses**: Clinic operational costs.
- **Reports**: Daily revenue and performance reports.

### Inventory (Stock)
- **Items & Categories**: Manage consumable supplies.
- **Movements**: Track usage and restocking.

### Settings & Administration
- **User Management**: Role-based access (Select User/Pin).
- **Clinic Info**: Customizable headers/logos for reports.
- **Backup**:
    - **Local**: Automatic scheduled backups.
    - **Cloud**: Integration with Google Drive (or similar).
- **Licensing**: Online verification system.

## 5. Directory Structure
```
/dental-flow-main
├── electron/               # Backend logic (Main process)
│   ├── db/                 # Database migrations/schema
│   ├── handlers/           # IPC Handlers
│   ├── server/             # Express API for Client Mode
│   └── services/           # Node.js services (Backup, etc.)
├── src/                    # Frontend (Renderer process)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # Global State (Auth, Lang)
│   ├── pages/              # Application Screens
│   ├── services/           # Frontend Data Services (API/IPC wrappers)
│   ├── lib/                # Utilities (utils, utils)
│   └── App.tsx             # Main Router
├── client-data/            # Storage for Client Mode (if needed)
├── release/                # Build artifacts
└── package.json            # Dependencies & Scripts
```

## 6. Build & Deployment
- **Development**: `npm run dev` (Runs Vite + Electron + TSC).
- **Production Build**: `npm run build` (TSC -> Vite Build -> Electron Builder).
- **Distributables**: Generates NSIS installers for Windows.

## 7. Critical Files Reference
- **Database Handlers**: `electron/handlers.ts`
  - Central logic for all database operations via IPC.
  - Implements Soft Delete logic for `services`, `doctors`, `cities`.
- **API Server**: `electron/server/api.ts`
  - Express endpoints mirroring `handlers.ts` for Client Mode.
  - Must stay synchronized with `handlers.ts` logic (e.g., Soft Delete updates).
- **Frontend DB Service**: `src/services/db.ts`
  - Facade pattern abstracting direct IPC calls vs HTTTP requests based on `isClientMode`.
- **Permission Verification**: `electron/utils/permissions.ts` (Implied usage in handlers) / `src/contexts/AuthContext.tsx`
  - Frontend `hasPermission` check.
  - Backend strict enforcement in `handlers.ts` and `api.ts`.
- **Sidebar Navigation**: `src/components/layout/Sidebar.tsx`
  - Permission-based route filtering.
- **Quick Actions**: `src/components/dashboard/DashboardQuickActions.tsx`
  - Dynamic button rendering based on permissions.

## 8. Recent Architectural Changes (Feb 2026)
### Soft Delete Implementation
- **Problem**: Hard deleting `services`, `doctors`, or `cities` caused referential integrity issues in historical data (e.g., invoices referring to a deleted service).
- **Solution**: 
  - Modified `DELETE` handlers in both `electron/handlers.ts` and `electron/server/api.ts`.
  - Instead of `DELETE FROM table ...`, now executes `UPDATE table SET is_deleted = 1 ...`.
  - Read queries (`getAll`) updated to filter `WHERE is_deleted IS NULL OR is_deleted = 0`.
  - Client Mode API now correctly returns success for delete operations, performing a soft delete on the server.


### Icon Management
- **Source**: `d:\dental-flow-main\assets\logo.png`.
- **Desktop Icon**: `public/icon.ico`.
- **Generation**: Created via `scripts/update-icons.js` which uses `sharp` to resize to 256x256 and `png-to-ico` to convert.

### Permission System Refinement

- **Granularity**: Added specific permissions like `VIEW_EXPENSES`, `CLINIC_SETTINGS` alongside standard `ADMIN`.
- **Enforcement**:
  - **Frontend**: `DashboardQuickActions.tsx` hides buttons (Add Expense, etc.) if permission missing.
  - **Backend**: `api.ts` checks `user.permissions.includes(...)` before executing sensitive operations (DELETE/POST).
  - **Context**: `UserManagementTab.tsx` allows assigning these granular permissions.

### Build Configuration Changes
- **Package.json Updates**:
  - Added strict `author` field to satisfy electron-builder requirements.
  - Removed redundant `@electron/rebuild` from devDependencies (handled internally by builder).

### Database Schema Updates
- **Migration 018 (Feb 2026)**: 
  - Automatically adds `is_deleted` (BOOLEAN DEFAULT 0) column to `services`, `doctors`, and `cities` tables if missing.
  - Ensures the backend "Soft Delete" logic (`UPDATE ... SET is_deleted=1`) works without "Column not found" errors.
  - Resolves Foreign Key constraint crashes when deleting referenced items.

## 9. Client Mode Specifics
- **Connection**: `src/services/db.ts` checks `window.electron` presence. If missing, assumes Client Mode and uses `localStorage` for `server_url`.
- **Limitations**:
  - No local DB access.
  - No direct file system access (e.g., local backup restore disabled).
  - Latency dependent on network.
- **Error Handling**: `db.ts` methods now wrap Axios calls and normalize error responses so UI receives consistent `{ data, error }` structure or throws predictably.

## 10. Mobile Application
- **Framework**: Capacitor (v6).
- **Assets**:
    - **Location**: `d:\dental-flow-main\assets` (Source PNGs: `logo.png`, `splash.png`).
    - **Generation**: `npx capacitor-assets generate --android` generates platform-specific icons and splash screens in `android/app/src/main/res`.
    - **Design**: Custom icon provided by user (blue tooth-like design).
- **Android Project**: Located in `android/`.
