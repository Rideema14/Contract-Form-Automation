
import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import {
  createBidder,
  createContract,
  createCostLine,
  createQuotation,
  downloadCostEstimateTemplate,
  deleteBidder,
  deleteContract,
  deleteCostLine,
  deleteQuotation,
  getContract,
  getCostEstimate,
  importCostEstimate,
  listBidders,
  listContracts,
  listCostLines,
  listDrafts,
  listEvaluations,
  listQuotations,
  saveDraft,
  saveEvaluations,
  submitContract,
  updateBidder,
  updateContract,
  updateCostLine,
  updateQuotation,
} from '../controllers/contracts.controller';
import { uploadCostEstimateWorkbook } from '../modules/documents/cost-estimate-upload';

const router = Router();

router.use(authenticate);

router.post('/', createContract);
router.get('/', listContracts);
router.get('/drafts', listDrafts);
router.get('/:id', getContract);
router.patch('/:id', updateContract);
router.post('/:id/save-draft', saveDraft);
router.delete('/:id', deleteContract);
router.post('/:id/submit', submitContract);

router.get('/:formId/bidders', listBidders);
router.post('/:formId/bidders', createBidder);
router.patch('/:formId/bidders/:bidderId', updateBidder);
router.delete('/:formId/bidders/:bidderId', deleteBidder);

router.get('/:formId/bidders/:bidderId/quotations', listQuotations);
router.post('/:formId/bidders/:bidderId/quotations', createQuotation);
router.patch('/:formId/bidders/:bidderId/quotations/:quotationId', updateQuotation);
router.delete('/:formId/bidders/:bidderId/quotations/:quotationId', deleteQuotation);

router.get('/:formId/cost-lines', listCostLines);
router.post('/:formId/cost-lines', createCostLine);
router.post('/:formId/cost-lines/import', uploadCostEstimateWorkbook, importCostEstimate);
router.patch('/:formId/cost-lines/:lineId', updateCostLine);
router.delete('/:formId/cost-lines/:lineId', deleteCostLine);

router.get('/:formId/cost-estimate', getCostEstimate);
router.get('/cost-estimate/template', downloadCostEstimateTemplate);
router.get('/:formId/evaluations', listEvaluations);
router.put('/:formId/evaluations', saveEvaluations);

export default router;
