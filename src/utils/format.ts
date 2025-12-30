export function formatDate(date: string | Date | undefined | null, language: string = 'en'): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // Force Gregorian calendar globally
    return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        calendar: 'gregory',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
}
