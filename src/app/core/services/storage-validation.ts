/** Runtime checks for browser-local records, without changing their stored format. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
export const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const isDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const uniqueIds = (rows: { id: string }[]): boolean =>
  new Set(rows.map((row) => row.id)).size === rows.length;
export const loadError = (status: string, subject: string): string =>
  status === 'unreadable'
    ? `Your ${subject} could not be loaded because browser storage is unavailable. Saving is blocked to protect your saved data. Allow site storage, then retry loading.`
    : status === 'invalid'
      ? `Your saved ${subject} has an invalid format. Saving is blocked and the original data has been kept. Correct the saved data, then retry loading.`
      : '';
