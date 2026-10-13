export function toCsv(rows:string[][]):string{
  return '\uFEFF'+rows.map(row=>row.map(value=>`"${(/^[=+\-@\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')}"`).join(';')).join('\r\n');
}
