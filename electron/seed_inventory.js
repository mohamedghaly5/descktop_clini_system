"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
// Helper to find DB
function findDbPath() {
    const appData = path_1.default.join(os_1.default.homedir(), 'AppData', 'Roaming');
    const possiblePaths = [
        path_1.default.join(appData, 'dental-flow', 'dental-flow.db'),
        path_1.default.join(appData, 'Dental Flow', 'dental-flow.db'),
    ];
    // Check explicitly for client-data in the current directory (dev mode specific)
    const localClientData = path_1.default.join(process.cwd(), 'client-data', 'dental-flow.db');
    if (fs_1.default.existsSync(localClientData)) {
        console.log(`Found DB at: ${localClientData}`);
        return localClientData;
    }
    // Check in AppData
    for (const p of possiblePaths) {
        if (fs_1.default.existsSync(p)) {
            console.log(`Found DB at: ${p}`);
            return p;
        }
    }
    // Checking default dev location
    const devDb = path_1.default.join(process.cwd(), 'dental-flow.db');
    if (fs_1.default.existsSync(devDb)) {
        return devDb;
    }
    // Default to the first possible path if none exist (it might fail to open if dir doesn't exist)
    console.log("Could not find DB. Using default path:", possiblePaths[0]);
    return possiblePaths[0];
}
const dbPath = findDbPath();
const db = new better_sqlite3_1.default(dbPath);
// Get Clinic ID
const clinicSettings = db.prepare('SELECT id FROM clinic_settings LIMIT 1').get();
const clinicId = clinicSettings?.id;
if (!clinicId) {
    console.error("No clinic found in settings! Cannot insert stock items.");
    process.exit(1);
}
console.log(`Using Clinic ID: ${clinicId}`);
const items = [
    // Requested special item
    ["Diagnosis & Infection Control / Scaling", 0],
    // Diagnosis & Infection Control / Scaling Group
    ["Chip syringe", 10],
    ["Manual scaler", 1],
    ["Metal handle mirror", 10],
    ["Manual curette", 3],
    ["Head mirror kit", 2],
    ["Scaling tip", 0],
    ["Plastic mirror", 5],
    ["Perio probe", 10],
    ["Tweezers (lock)", 10],
    ["Kit تعقيم أدوات", 0],
    ["Diagnostic gloves", 20],
    ["Rubber gloves (medium)", 10],
    ["Wrap", 10],
    ["Mask", 10],
    ["Napkin", 10],
    ["Pouch", 5],
    ["Suction tip", 10],
    ["Cotton", 10],
    ["Cotton roll large", 0],
    ["Cidex", 3],
    ["Plastic cup", 10],
    ["Stainless steel brush", 2],
    // RCT
    ["Endo probe", 10],
    ["Endo ruler (ring metal)", 5],
    ["Torch", 1],
    ["Activation tip", 0],
    ["Gutta percha cutter tip", 3],
    ["Caliper", 2],
    ["Bite block", 4],
    ["Compule gun", 1],
    ["Manual files #10", 5],
    ["Manual files #15", 5],
    ["Manual files #20", 2],
    ["Long manual #10", 2],
    ["Long manual #15", 2],
    ["Long manual #20", 2],
    ["C-files #10,15,20", 0],
    ["Rotary orifice", 2],
    ["Rotary file 15/.03", 3],
    ["Rotary file 20/.04", 5],
    ["Rotary file 25/.04", 3],
    ["Rotary file 30/.04", 3],
    ["Rotary file 35/.04", 2],
    ["Rotary file 40/.04", 1],
    ["Rotary file 25/.06", 2],
    ["Long rotary files kit", 2],
    // Gutta Percha
    ["Gutta Percha 25/.04", 2],
    ["Gutta Percha 30/.04", 3],
    ["Gutta Percha 35/.04", 3],
    ["Gutta Percha 80/.02", 1],
    // Paper Points
    ["Paper Points 30/.02", 5],
    ["Paper Points 35/.02", 3],
    // Mixed Materials 
    ["EDTA gel", 1],
    ["Endo Ice", 1],
    ["Collagen sponge", 2],
    ["Formacresol", 1],
    ["Gutta solvent", 1],
    ["Heamostop", 1],
    ["MTA putty", 5],
    ["Sealer Sealapex", 2],
    ["Metapaste", 2],
    ["Metapex", 2],
    // Restorative
    ["Rubber dam sheet (heavy)", 3],
    ["Rubber dam frame", 5],
    ["Rubber dam forceps", 5],
    ["Rubber dam puncher", 3],
    // Restorative Tools
    ["Condenser small", 10],
    ["Applicator wide", 7],
    ["Applicator thin", 3],
    ["Ball burnisher", 10],
    ["Excavator", 3],
    ["Matrix holder (Teflonire)", 3],
    ["Unica matrix", 1],
    ["Wooden wedge", 2],
    ["Spoon matrix", 2],
    ["Teflon", 5],
    ["Dental floss", 5],
    // Restorative Materials
    ["Composite packable", 4],
    ["Flowable", 4],
    ["EverX fiber composite", 10],
    ["Bond Bisco", 1],
    ["Etch", 5],
    ["Bond brush", 10],
    ["Finishing disk", 2],
    ["Finishing strip", 1],
    ["Celluloid strip", 1],
    ["Articulating paper", 1],
    ["Temporary filling", 2],
    ["Temporary crown", 1],
    ["Fiber post", 10],
    ["Charm core", 1],
    // Fixed & Impression
    ["Cement spatula", 5],
    ["Shade guide", 1],
    ["Alginate spatula metal", 3],
    ["Rubber base Zetaplus", 1],
    ["Alginate Zermac medium", 2],
    ["Stone Zermac", 2],
    ["Stock tray", 20],
    ["Pink wax", 1],
    // Surgery
    ["Scalpel handle", 3],
    ["Blade #15", 1],
    ["Needle holder", 3],
    ["Tissue forceps", 3],
    ["Scissor", 5],
    ["Mucoperiosteal elevator", 3],
    ["Bone file", 3],
    ["Bone curette", 3],
    ["Minnesotta retractor", 3],
    ["Kidney dish", 3],
    ["Kit forceps", 2],
    ["Cowhorn forceps", 1],
    ["Elevators set", 2],
    ["Straight elevators sizes", 5],
    ["Surgical burs", 10],
    ["Long needle", 2],
    ["Short needle", 2],
    ["Gauze", 5],
    ["Anesthesia", 5],
    ["Topical gel", 3],
    ["Topical spray", 2],
    // Pedo
    ["St. steel crown anti spot", 0],
    ["Stretchers #03", 1],
    ["Stretchers #05", 1],
    // Bleaching
    ["Cheek retractor", 5],
    ["Zinc O/E bleaching kit", 2],
    ["Liquidam", 0],
    // Scaling & Polishing
    ["Polishing brush", 1],
    ["Polishing paste", 1],
    ["Sodium bicarbonate", 0],
    ["H₂O₂", 5],
    ["Chlorhexidine", 1],
    ["B-fresh", 3]
];
const insertStmt = db.prepare(`
    INSERT INTO stock_items (clinic_id, name, quantity, min_quantity)
    VALUES (?, ?, ?, 0)
`);
const checkStmt = db.prepare('SELECT id FROM stock_items WHERE name = ? AND clinic_id = ?');
const updateStmt = db.prepare('UPDATE stock_items SET quantity = ? WHERE id = ?');
// Note: User says "Add", but logic to overwrite or add?
// Prompt says: "Add these materials ... default counter zero for [item]"
// I will blindly overwrite quantity to match the list if it exists, or insert if not. 
// "Add" usually implies "Current + New" but "Counter zero" implies specific state.
// Since this looks like a setup list, I'll set the quantity to exactly what is listed.
const transaction = db.transaction(() => {
    for (const [name, qty] of items) {
        const existing = checkStmt.get(name, clinicId);
        if (existing) {
            console.log(`Updating ${name} to ${qty}`);
            updateStmt.run(qty, existing.id);
        }
        else {
            console.log(`Inserting ${name} with ${qty}`);
            insertStmt.run(clinicId, name, qty);
        }
    }
});
try {
    transaction();
    console.log('Stock items seeded successfully.');
}
catch (err) {
    console.error('Migration failed:', err);
}
