// src/api/financeController.ts
// Handles API requests for portfolio holdings, product catalogs, investing, and redeeming assets.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { financeService } from '../services/financeService';

const router = Router();

/**
 * GET /finance/products
 * Returns the catalog of active investment products available in the simulator.
 * Public endpoint (does not require authentication as per specification).
 */
router.get('/products', (_req: Request, res: Response) => {
  const products = financeService.getProducts();
  res.status(200).json({ products });
});

// All other finance operations require authentication
router.use(requireAuth);

/**
 * GET /finance/:profileId/portfolio
 * Returns the portfolio (list of obligations and investments) for the profile.
 */
router.get('/:profileId/portfolio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const result = await financeService.getPortfolio(req.user!.userId, profileId!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /finance/:profileId/invest
 * Purchases an investment product.
 * Body: { productCode: string, amount: number }
 */
router.post('/:profileId/invest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const { productCode, amount } = req.body;

    if (!productCode || !amount) {
      res.status(400).json({ error: 'productCode and amount are required', code: 'MISSING_FIELDS' });
      return;
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'amount must be a positive integer', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await financeService.invest(req.user!.userId, profileId!, productCode, parsedAmount);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /finance/:profileId/redeem
 * Redeems (liquidates) an active investment asset.
 * Body: { investmentId: string }
 */
router.post('/:profileId/redeem', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const { investmentId } = req.body;

    if (!investmentId) {
      res.status(400).json({ error: 'investmentId is required', code: 'MISSING_FIELDS' });
      return;
    }

    const result = await financeService.redeem(req.user!.userId, profileId!, investmentId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
