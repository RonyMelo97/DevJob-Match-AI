import {it,expect} from 'vitest';
import {toCsv} from './csv';
it('exports Portuguese text, quotes and newlines without spreadsheet formulas',()=>{
  expect(toCsv([['Empresa','Fit'],['São Paulo "TI"',''],['=HYPERLINK("x")','+1']])).toBe('\uFEFF"Empresa";"Fit"\r\n"São Paulo ""TI""";""\r\n"\'=HYPERLINK(""x"")";"\'+1"');
});
