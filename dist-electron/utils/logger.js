/**
 * Lightweight logger utility for the Electron main process.
 * Filters out debug logs and warnings in production.
 */
import { app } from 'electron';
const isDev = !app.isPackaged;
export const logger = {
    log: (...args) => {
        if (isDev) {
            console.log(...args);
        }
    },
    info: (...args) => {
        if (isDev) {
            console.info(...args);
        }
    },
    warn: (...args) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args) => {
        // Always log errors
        console.error(...args);
    }
};
