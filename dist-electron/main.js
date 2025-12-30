"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const handlers_1 = require("./handlers");
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:8080'); // Adjust port if needed
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(async () => {
    try {
        (0, database_1.initializeDatabase)();
        (0, handlers_1.registerHandlers)();
        createWindow();
    }
    catch (error) {
        console.error('Failed to initialize app', error);
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // DEBUG: Log cities table to console
    try {
        const db = require('./database').getDb();
        const cities = db.prepare('SELECT * FROM cities').all();
        console.log('--- DEBUG: CITIES TABLE ---');
        console.table(cities);
        const patients = db.prepare('SELECT * FROM patients').all();
        console.log('--- DEBUG: PATIENTS TABLE ---');
        console.table(patients);
    }
    catch (e) {
        console.error('--- DEBUG: Failed to read existing tables', e);
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
