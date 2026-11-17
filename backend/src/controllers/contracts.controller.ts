import { NextFunction, Request, Response } from 'express';
import {
  bidderParamsSchema,
  bidderSchema,
  contractDraftSchema,
  contractIdSchema,
  contractListQuerySchema,
  costLineParamsSchema,
  costLineSchema,
  evaluationSchema,
  evaluationsSchema,
  quotationParamsSchema,
  quotationSchema,
  submitSchema,
} from '../schemas/contract.schema';
import * as contractService from '../services/contract.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

function parse<T>(result: { success: boolean; data?: T; error?: { issues: unknown[] } }): T {
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', result.error?.issues ?? []);
  }
  return result.data as T;
}

function user(req: Request) {
  if (!req.authUser) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  return req.authUser;
}

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await contractService.createDraft(user(req), parse(contractDraftSchema.safeParse(req.body)));
    sendSuccess(req, res, 201, 'Contract created', data);
  } catch (error) { next(error); }
}

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parse(contractListQuerySchema.safeParse(req.query));
    const data = await contractService.listContracts(user(req), query);
    sendSuccess(req, res, 200, 'Contracts retrieved', { items: data.items }, { pagination: data.pagination });
  } catch (error) { next(error); }
}

export async function getContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = parse(contractIdSchema.safeParse(req.params));
    const data = await contractService.getContract(id, user(req));
    sendSuccess(req, res, 200, 'Contract retrieved', data);
  } catch (error) { next(error); }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = parse(contractIdSchema.safeParse(req.params));
    const data = await contractService.updateContract(id, user(req), parse(contractDraftSchema.safeParse(req.body)));
    sendSuccess(req, res, 200, 'Contract updated', data);
  } catch (error) { next(error); }
}

export async function saveDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = parse(contractIdSchema.safeParse(req.params));
    const data = await contractService.updateContract(id, user(req), parse(contractDraftSchema.safeParse(req.body)));
    sendSuccess(req, res, 200, 'Draft saved', data);
  } catch (error) { next(error); }
}

export async function listDrafts(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(req, res, 200, 'Drafts retrieved', { items: await contractService.listDrafts(user(req)) });
  } catch (error) { next(error); }
}

export async function deleteContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = parse(contractIdSchema.safeParse(req.params));
    await contractService.deleteContract(id, user(req));
    sendSuccess(req, res, 200, 'Contract deleted', { id });
  } catch (error) { next(error); }
}

export async function submitContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = parse(contractIdSchema.safeParse(req.params));
    parse(submitSchema.safeParse(req.body));
    sendSuccess(req, res, 200, 'Contract submitted', await contractService.submitContract(id, user(req)));
  } catch (error) { next(error); }
}

export async function listBidders(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(bidderParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 200, 'Bidders retrieved', { items: await contractService.listBidders(formId, user(req)) });
  } catch (error) { next(error); }
}

export async function createBidder(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(bidderParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 201, 'Bidder created', await contractService.createBidder(formId, user(req), parse(bidderSchema.safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function updateBidder(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(bidderParamsSchema.safeParse(req.params));
    sendSuccess(req, res, 200, 'Bidder updated', await contractService.updateBidder(params.formId, params.bidderId, user(req), parse(bidderSchema.partial().safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function deleteBidder(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(bidderParamsSchema.safeParse(req.params));
    await contractService.deleteBidder(params.formId, params.bidderId, user(req));
    sendSuccess(req, res, 200, 'Bidder deleted', { id: params.bidderId });
  } catch (error) { next(error); }
}

export async function listQuotations(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(bidderParamsSchema.safeParse(req.params));
    sendSuccess(req, res, 200, 'Quotations retrieved', { items: await contractService.listQuotations(params.formId, params.bidderId, user(req)) });
  } catch (error) { next(error); }
}

export async function createQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(bidderParamsSchema.safeParse(req.params));
    sendSuccess(req, res, 201, 'Quotation created', await contractService.createQuotation(params.formId, params.bidderId, user(req), parse(quotationSchema.safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function updateQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(quotationParamsSchema.safeParse(req.params));
    sendSuccess(req, res, 200, 'Quotation updated', await contractService.updateQuotation(params.formId, params.bidderId, params.quotationId, user(req), parse(quotationSchema.partial().safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function deleteQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(quotationParamsSchema.safeParse(req.params));
    await contractService.deleteQuotation(params.formId, params.bidderId, params.quotationId, user(req));
    sendSuccess(req, res, 200, 'Quotation deleted', { id: params.quotationId });
  } catch (error) { next(error); }
}

export async function listCostLines(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(costLineParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 200, 'Cost lines retrieved', { items: await contractService.listCostLines(formId, user(req)) });
  } catch (error) { next(error); }
}

export async function createCostLine(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(costLineParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 201, 'Cost line created', await contractService.createCostLine(formId, user(req), parse(costLineSchema.safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function updateCostLine(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(costLineParamsSchema.safeParse(req.params));
    sendSuccess(req, res, 200, 'Cost line updated', await contractService.updateCostLine(params.formId, params.lineId, user(req), parse(costLineSchema.partial().safeParse(req.body))));
  } catch (error) { next(error); }
}

export async function deleteCostLine(req: Request, res: Response, next: NextFunction) {
  try {
    const params = parse(costLineParamsSchema.safeParse(req.params));
    await contractService.deleteCostLine(params.formId, params.lineId, user(req));
    sendSuccess(req, res, 200, 'Cost line deleted', { id: params.lineId });
  } catch (error) { next(error); }
}

export async function getCostEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(costLineParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 200, 'Cost estimate retrieved', await contractService.getCostEstimate(formId, user(req)));
  } catch (error) { next(error); }
}

export async function listEvaluations(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(costLineParamsSchema.pick({ formId: true }).safeParse(req.params));
    sendSuccess(req, res, 200, 'Evaluations retrieved', { items: await contractService.listEvaluations(formId, user(req)) });
  } catch (error) { next(error); }
}

export async function saveEvaluations(req: Request, res: Response, next: NextFunction) {
  try {
    const { formId } = parse(costLineParamsSchema.pick({ formId: true }).safeParse(req.params));
    const body = req.body?.evaluations ? parse(evaluationsSchema.safeParse(req.body)).evaluations : [parse(evaluationSchema.safeParse(req.body))];
    sendSuccess(req, res, 200, 'Evaluations saved', { items: await contractService.saveEvaluations(formId, user(req), body) });
  } catch (error) { next(error); }
}
