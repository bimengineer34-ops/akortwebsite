const formatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/** "12 Mart 2024" */
export const formatDate = (date: Date): string => formatter.format(date);

/** `<time datetime>` için YYYY-MM-DD */
export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
