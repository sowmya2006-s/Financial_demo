import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { spendService } from '../services/spendService';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, category, itemName, amount } = req.body;
    
    if (!profileId || !category || !itemName || !amount) {
      res.status(400).json({ error: 'profileId, category, itemName, and amount are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await spendService.spend(profileId, { category, itemName, amount });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
