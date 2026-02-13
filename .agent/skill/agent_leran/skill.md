---
name: Agent Learn & Document
description: A skill to enforce reading project context before coding and documenting changes afterwards.
---

# Agent Learn & Document Strategy

## 1. Context Acquisition (BEFORE Coding)
**CRITICAL**: Before writing or modifying ANY code when this skill is active or referenced:
1. **Read Project Memory**: You MUST read the file `project_tech_memory.md` in the root directory.
2. **Understand Connectivity**: Pay special attention to the "Hybrid Client/Server" architecture sections to ensure your code works for both:
   - **Local Electron Mode**: Using `ipcRenderer`.
   - **Client Mode**: Using `Axios/HTTP` requests to the internal API.
3. **Check patterns**: Look for established patterns in `db.ts`, `handlers.ts`, and `api.ts` to maintain consistency.

## 2. Implementation
- Write code that adheres strictly to the patterns found in the project memory.
- Ensure all database operations handle both Direct IPC (server) and HTTP (client) paths if applicable.
- Respect the strict TypeScript typing and strict mode settings.

## 3. Documentation (AFTER Coding)
**MANDATORY**: After successfully implementing the requested changes:
1. **Update Project Memory**: Open `project_tech_memory.md` again.
2. **Log Changes**: Append a brief summary of your architectural changes, new file structures, or critical logic updates under a "Recent Changes" or relevant section.
   - Example: "Added Soft Delete to Service X", "Refactored Auth Context to include Permission Y".
3. **Verify**: Ensure the documentation accurately reflects the NEW state of the codebase so the next session has the latest truth.