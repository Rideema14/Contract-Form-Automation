import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  createCostEstimateTemplate,
  parseCostEstimateWorkbook,
} from './cost-estimate-excel.service';

async function workbookBuffer(rows: Array<Array<string | number | null>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cost Estimate');
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('cost estimate Excel workbook', () => {
  it('creates a template that imports standard rows and skips blank rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const template = await createCostEstimateTemplate();
    const templateBuffer = new ArrayBuffer(template.byteLength);
    new Uint8Array(templateBuffer).set(template);
    await workbook.xlsx.load(templateBuffer);
    const sheet = workbook.worksheets[0];
    sheet.addRow(['Consulting', 2, 125.5]);
    sheet.addRow([null, null, null]);

    await expect(
      parseCostEstimateWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).resolves.toEqual([
      { description: 'Consulting', quantity: '2', unitCost: '125.5' },
    ]);
  });

  it('rejects missing required columns', async () => {
    await expect(
      parseCostEstimateWorkbook(await workbookBuffer([
        ['Description', 'Amount'],
        ['Travel', 100],
      ])),
    ).rejects.toMatchObject({
      code: 'INVALID_COST_ESTIMATE',
      details: expect.arrayContaining([
        expect.objectContaining({ message: 'Missing "quantity" column.' }),
      ]),
    });
  });

  it('rejects invalid numbers and formula cells instead of importing partial data', async () => {
    await expect(
      parseCostEstimateWorkbook(await workbookBuffer([
        ['Description', 'Quantity', 'Unit Cost'],
        ['Travel', -1, 100],
      ])),
    ).rejects.toMatchObject({ code: 'INVALID_COST_ESTIMATE' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cost Estimate');
    sheet.addRow(['Description', 'Quantity', 'Unit Cost']);
    sheet.addRow(['Travel', 1, 100]);
    sheet.getCell('B2').value = { formula: '1+1' };
    await expect(
      parseCostEstimateWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).rejects.toMatchObject({ code: 'INVALID_COST_ESTIMATE' });
  });
});
