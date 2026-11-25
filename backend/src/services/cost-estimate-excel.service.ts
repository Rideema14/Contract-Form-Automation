import ExcelJS from 'exceljs';
import { AppError } from '../utils/app-error';

export type CostEstimateRowInput = {
  description: string;
  quantity: string;
  unitCost: string;
};

const MAX_COST_LINES = 500;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,4})?$/;

export async function createCostEstimateTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Contract Forms Automation';
  const sheet = workbook.addWorksheet('Cost Estimate');
  sheet.columns = [
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Quantity', key: 'quantity', width: 16 },
    { header: 'Unit Cost', key: 'unitCost', width: 18 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:C1';
  sheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function invalidWorkbook(message: string, details: unknown[] = []): AppError {
  return new AppError(400, 'INVALID_COST_ESTIMATE', message, details);
}

function scalarCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  return typeof value === 'object' && value !== null ? undefined : value;
}

function parseDecimalCell(value: unknown, rowNumber: number, column: string): string {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';

  if (!DECIMAL_PATTERN.test(text)) {
    throw invalidWorkbook(
      'The Excel file contains invalid cost data',
      [{ path: `row ${rowNumber}.${column}`, message: 'Enter a non-negative number with up to 4 decimal places.' }],
    );
  }

  return text;
}

export async function parseCostEstimateWorkbook(
  buffer: Uint8Array,
): Promise<CostEstimateRowInput[]> {
  if (buffer.length === 0 || buffer.length > MAX_WORKBOOK_BYTES) {
    throw invalidWorkbook('The Excel file is empty or exceeds the 5 MiB import limit.');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw invalidWorkbook('The uploaded file is not a valid .xlsx workbook.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) {
    throw invalidWorkbook('The Excel workbook must contain a worksheet with a header row.');
  }

  const headerMap = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = scalarCellValue(cell);
    if (typeof header === 'string') {
      headerMap.set(header.trim().toLowerCase(), columnNumber);
    }
  });

  const requiredHeaders = ['description', 'quantity', 'unit cost'];
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(header));
  if (missingHeaders.length) {
    throw invalidWorkbook(
      'The Excel file does not match the cost estimate template.',
      missingHeaders.map((header) => ({ path: 'headers', message: `Missing "${header}" column.` })),
    );
  }

  if (sheet.rowCount > MAX_COST_LINES + 1) {
    throw invalidWorkbook(`The Excel file can contain at most ${MAX_COST_LINES} cost rows.`);
  }

  const rows: CostEstimateRowInput[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const descriptionValue = scalarCellValue(row.getCell(headerMap.get('description')!));
    const quantityValue = scalarCellValue(row.getCell(headerMap.get('quantity')!));
    const unitCostValue = scalarCellValue(row.getCell(headerMap.get('unit cost')!));

    if (descriptionValue == null && quantityValue == null && unitCostValue == null) {
      continue;
    }

    const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : '';
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      throw invalidWorkbook(
        'The Excel file contains invalid cost data',
        [{ path: `row ${rowNumber}.description`, message: 'Enter a description up to 10,000 characters.' }],
      );
    }

    rows.push({
      description,
      quantity: parseDecimalCell(quantityValue, rowNumber, 'quantity'),
      unitCost: parseDecimalCell(unitCostValue, rowNumber, 'unit cost'),
    });
  }

  if (rows.length === 0) {
    throw invalidWorkbook('The Excel file does not contain any cost rows.');
  }

  return rows;
}
