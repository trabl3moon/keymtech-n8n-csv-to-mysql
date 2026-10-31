// "Validate & Map" Code node (Run Once for All Items).
// Reads the mapping from the Settings node and every row from Extract CSV.
// Each output item is one CSV row: mapped DB fields + _line, _valid, _errors.
const s = $('Settings').first().json;
const rows = $('Extract CSV').all().map(i => i.json);
const map = s.columnMap || {};
const required = new Set(s.required || []);
const types = s.types || {};
const maxLength = s.maxLength || {};

if (!rows.length) throw new Error('The CSV has no data rows.');

// Fail fast if the CSV header doesn't contain a mapped column: that's a setup problem, not a bad row.
const header = Object.keys(rows[0]);
const missing = Object.keys(map).filter(c => !header.includes(c));
if (missing.length) {
  throw new Error(`CSV is missing mapped column(s): ${missing.join(', ')}. Found: ${header.join(', ')}. Update columnMap in the Settings node.`);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDate(v) {
  let y, m, d;
  let r = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [, y, m, d] = r;
  else if ((r = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) {
    // Day-first by default (DD/MM/YYYY); set "dayFirst": false in Settings for MM/DD/YYYY files.
    [, d, m, y] = r;
    if (s.dayFirst === false) [d, m] = [m, d];
  } else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function convert(type, v) {
  switch (type) {
    case 'integer': return /^-?\d+$/.test(v) ? parseInt(v, 10) : undefined;
    case 'number': {
      const n = v.replace(/,/g, '');
      return /^-?\d+(\.\d+)?$/.test(n) ? Number(n) : undefined;
    }
    case 'date': return toDate(v) ?? undefined;
    case 'email': return EMAIL.test(v) ? v.toLowerCase() : undefined;
    case 'boolean': {
      const b = v.toLowerCase();
      if (['true', 'yes', '1', 'y'].includes(b)) return 1;
      if (['false', 'no', '0', 'n'].includes(b)) return 0;
      return undefined;
    }
    default: return v;
  }
}

return rows.map((row, i) => {
  const out = {};
  const errors = [];
  for (const [csvCol, dbCol] of Object.entries(map)) {
    const raw = row[csvCol] == null ? '' : String(row[csvCol]).trim();
    if (raw === '') {
      if (required.has(dbCol)) errors.push(`${csvCol}: required`);
      out[dbCol] = null;
      continue;
    }
    const value = convert(types[dbCol], raw);
    if (value === undefined) {
      errors.push(`${csvCol}: "${raw}" is not a valid ${types[dbCol]}`);
      continue;
    }
    if (maxLength[dbCol] && String(value).length > maxLength[dbCol]) {
      errors.push(`${csvCol}: longer than ${maxLength[dbCol]} characters`);
      continue;
    }
    out[dbCol] = value;
  }
  return { json: { ...out, _line: i + 2, _valid: errors.length === 0, _errors: errors.join('; ') } };
});
