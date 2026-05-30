// src/api/insuranceController.ts
// Routes for insurance management: purchasing, listing, and canceling policies.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { insuranceService, InsuranceType } from '../services/insuranceService';

const router = Router();
router.use(requireAuth);

/**
 * GET /insurance/products
 * Lists all available insurance products.
 */
router.get('/products', (_req: Request, res: Response) => {
  const products = insuranceService.getProducts();
  res.status(200).json({ products });
});

/**
 * POST /insurance/purchase
 * Purchases an insurance policy.
 * Body: { profileId: string, type: 'HEALTH' | 'VEHICLE' | 'PROPERTY' | 'JOB' }
 */
router.post('/purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, type } = req.body;

    if (!profileId || !type) {
      res.status(400).json({
        error: 'profileId and type are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const validTypes = ['HEALTH', 'VEHICLE', 'PROPERTY', 'JOB'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: `Invalid insurance type. Must be one of: ${validTypes.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const insurance = await insuranceService.purchaseInsurance(
      req.user!.userId,
      profileId,
      type as InsuranceType
    );

    res.status(201).json({ insurance });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /insurance/:profileId/active
 * Gets all active insurance policies for a profile.
 */
router.get('/:profileId/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;

    // Verify profile ownership
    const insurance = await insuranceService.getActiveInsurance(profileId);
    res.status(200).json({ insurance });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /insurance/:profileId/:type
 * Cancels/deactivates an insurance policy.
 */
router.delete('/:profileId/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, type } = req.params;

    if (!['HEALTH', 'VEHICLE', 'PROPERTY', 'JOB'].includes(type)) {
      res.status(400).json({
        error: 'Invalid insurance type',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    await insuranceService.cancelInsurance(
      req.user!.userId,
      profileId,
      type as InsuranceType
    );

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
