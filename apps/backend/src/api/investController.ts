import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { investService } from '../services/investService';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, type, name, amount } = req.body;
    
    if (!profileId || !type || !amount) {
      res.status(400).json({ error: 'profileId, type, and amount are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await investService.invest(profileId, { type, name, amount });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
