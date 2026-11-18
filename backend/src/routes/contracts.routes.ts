import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import {
  createBidder, createContract, createCostLine, createQuotation,
  deleteBidder, deleteCostLine, deleteQuotation, getContract,
  listBidders, listContracts, listCostLines, listQuotations,
  updateBidder, updateContract, updateCostLine, updateQuotation, submitContract,
} from '../controllers/contracts.controller';

const router = Router();
router.use(authenticate);

router.post('/', createContract);
router.get('/', listContracts);
router.get('/:id', getContract);
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
router.patch('/:formId/cost-lines/:lineId', updateCostLine);
router.delete('/:formId/cost-lines/:lineId', deleteCostLine);

export default router;
