import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { loanService } from '../services/loanService';

const router = Router();
router.use(requireAuth);

/**
 * POST /loans/request
 * Requests a loan with approval logic based on credit score, debt, and difficulty.
 * Returns { approved, approvalChance, reason?, loan?, emiAmount? }
 */
router.post('/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, type, amount } = req.body;
    
    if (!profileId || !type || !amount) {
      res.status(400).json({ error: 'profileId, type, and amount are required', code: 'VALIDATION_ERROR' });
      return;
    }

    if (!['HOME', 'VEHICLE', 'PERSONAL', 'EDUCATION'].includes(type)) {
      res.status(400).json({ error: 'Invalid loan type. Must be HOME, VEHICLE, PERSONAL, or EDUCATION', code: 'VALIDATION_ERROR' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Loan amount must be greater than zero', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await loanService.requestLoan(profileId, { type, amount });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /loans/create (legacy)
 * Creates a loan without approval logic.
 * @deprecated Use /loans/request for new code
 */
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, type, amount, tenureMonths, interestRate } = req.body;
    
    if (!profileId || !type || !amount) {
      res.status(400).json({ error: 'profileId, type, and amount are required', code: 'VALIDATION_ERROR' });
      return;
    }

    if (!['HOME', 'VEHICLE', 'PERSONAL'].includes(type)) {
      res.status(400).json({ error: 'Invalid loan type', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await loanService.createLoan(profileId, { type, amount, tenureMonths, interestRate });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
