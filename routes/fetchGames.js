import express from 'express';
import fetchAllGames from '../middleware/fetchAllGames.js';

const router = express.Router();

router.get('/fetch-games', fetchAllGames);

export default router;
