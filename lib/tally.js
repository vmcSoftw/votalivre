export function summarize(options) {
  const rows = options.map(row => ({ ...row, votes: Number(row.votes) }));
  const turnout = rows.reduce((sum, row) => sum + row.votes, 0);
  const valid = rows.filter(row => row.kind === 'candidate').reduce((sum, row) => sum + row.votes, 0);
  return { rows, turnout, valid, invalid: turnout - valid };
}
