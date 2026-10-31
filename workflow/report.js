// "Build Report" Code node (Run Once for All Items).
// Collects rows skipped by validation plus rows MySQL rejected, and returns:
//   json:   a summary (total / inserted / skipped)
//   binary: error_log.csv (only the header line when nothing failed)
const all = $('Validate & Map').all().map(i => i.json);
const invalid = all.filter(r => !r._valid).map(r => ({ line: r._line, stage: 'validation', error: r._errors }));

// Valid rows reach MySQL in order, one result item each. A rejected row comes back with an `error` field.
const valid = all.filter(r => r._valid);
let dbResults = [];
try { dbResults = $('Insert into MySQL').all().map(i => i.json); } catch (e) { /* no valid rows: MySQL never ran */ }
const rejected = [];
dbResults.forEach((res, idx) => {
  if (res && res.error) {
    const src = valid[idx] || {};
    const msg = typeof res.error === 'string' ? res.error : (res.error.message || JSON.stringify(res.error));
    rejected.push({ line: src._line ?? '', stage: 'database', error: msg });
  }
});

const errors = [...invalid, ...rejected].sort((a, b) => a.line - b.line);
const inserted = valid.length - rejected.length;

const esc = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = ['line,stage,error', ...errors.map(e => [e.line, e.stage, e.error].map(esc).join(','))].join('\n') + '\n';

return [{
  json: {
    total_rows: all.length,
    inserted,
    skipped: errors.length,
    table: $('Settings').first().json.table,
    message: `${inserted} of ${all.length} rows imported into ${$('Settings').first().json.table}. ${errors.length} skipped.`,
  },
  binary: {
    data: await this.helpers.prepareBinaryData(Buffer.from(csv, 'utf8'), 'error_log.csv', 'text/csv'),
  },
}];
