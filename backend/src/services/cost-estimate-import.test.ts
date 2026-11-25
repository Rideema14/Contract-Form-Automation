import { ContractStatus, Prisma, UserRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { importCostLines } from './contract.service';

const submitter = { id: 'user-1', role: UserRole.SUBMITTER };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('importCostLines', () => {
  it('appends all imported rows after existing rows in one transaction', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    const create = vi.fn(async (args: {
      data: { sortOrder: number; amount: Prisma.Decimal; [key: string]: unknown };
    }) => ({ id: `line-${args.data.sortOrder}`, ...args.data }));
    const tx = {
      costLine: {
        aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
        create,
      },
    };
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );

    const result = await importCostLines('form-1', submitter, [
      { description: 'Consulting', quantity: '2', unitCost: '125.50' },
      { description: 'Travel', quantity: '1', unitCost: '40' },
    ]);

    expect(transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([call]) => call.data.sortOrder)).toEqual([3, 4]);
    expect(create.mock.calls.map(([call]) => call.data.amount.toString())).toEqual(['251', '40']);
    expect(result).toHaveLength(2);
  });

  it('does not import rows for a form owned by someone else', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'another-user',
      status: ContractStatus.DRAFT,
    } as never);
    const transaction = vi.spyOn(prisma, '$transaction');

    await expect(
      importCostLines('form-1', submitter, [
        { description: 'Consulting', quantity: '1', unitCost: '10' },
      ]),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
