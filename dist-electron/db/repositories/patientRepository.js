import { getDb } from '../init.js';
import { randomUUID } from 'crypto';
export class PatientRepository {
    db = getDb();
    getAll(clinicId) {
        let query = 'SELECT * FROM patients ORDER BY created_at DESC';
        const params = [];
        if (clinicId) {
            query = 'SELECT * FROM patients WHERE clinic_id = ? ORDER BY created_at DESC';
            params.push(clinicId);
        }
        return this.db.prepare(query).all(...params);
    }
    getById(id) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    }
    create(data) {
        const id = randomUUID();
        try {
            // Get next display_id
            const maxId = this.db.prepare('SELECT MAX(display_id) as max FROM patients').get()?.max || 0;
            const displayId = maxId + 1;
            const stmt = this.db.prepare(`
                INSERT INTO patients (
                    id, display_id, full_name, phone, gender, age, city_id, 
                    notes, clinic_id, medical_history, dob
                ) VALUES (
                    @id, @displayId, @full_name, @phone, @gender, @age, @city_id,
                    @notes, @clinic_id, @medical_history, @dob
                )
            `);
            stmt.run({
                id,
                displayId,
                full_name: data.full_name,
                phone: data.phone,
                gender: data.gender,
                age: data.age,
                city_id: data.city_id,
                notes: data.notes,
                clinic_id: data.clinic_id,
                medical_history: data.medical_history,
                dob: data.dob
            });
            return { success: true, data: { id, display_id: displayId, ...data } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    update(id, data) {
        try {
            const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'display_id');
            if (keys.length === 0)
                return { success: true };
            const setClause = keys.map(k => `${k} = @${k}`).join(', ');
            const stmt = this.db.prepare(`
                UPDATE patients 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
                WHERE id = @id
            `);
            stmt.run({ ...data, id });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    delete(id) {
        try {
            this.db.prepare('DELETE FROM patients WHERE id = ?').run(id);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
}
