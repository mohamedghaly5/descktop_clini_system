import nodeMachineId from 'node-machine-id';
const { machineIdSync } = nodeMachineId;
import { userInfo } from 'os';
import { app } from 'electron';
import crypto from 'crypto';
/**
 * Generates a stable device fingerprint for the license system.
 * specific to the machine + user + install path context.
 */
export function getDeviceFingerprint() {
    try {
        const mId = machineIdSync(true); // Stable hardware ID
        const user = userInfo().username;
        // We include app path to ensure multiple installations don't conflict/share if side-by-side
        // though typically we want to lock to the PC.
        // Prompt asked for: OS username, machine id, app install path.
        const installPath = app.getPath('userData');
        const raw = `${mId}|${user}|${installPath}`;
        // Return SHA-256 hash
        return crypto.createHash('sha256').update(raw).digest('hex');
    }
    catch (error) {
        console.error('Fingerprint generation failed', error);
        // Fallback if machine-id fails (rare)
        return 'fallback-fingerprint-unknown-device';
    }
}
