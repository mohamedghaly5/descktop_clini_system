/**
 * Lightweight logger utility for the Electron main process.
 * Filters out debug logs and warnings in production.
 */
import { app } from 'electron';

const isDev = !app.isPackaged;

export const logger = {
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: any[]) => {
        // Always log errors
        console.error(...args);
    }
};
