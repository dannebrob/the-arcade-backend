import express from 'express';

const router = express.Router();

router.post('/create', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await openai.createImage({
      prompt,
      n: 1,
      size: '512x512'
    });
    res.send(response.data.data[0].url);
  } catch (err) {
    res.send(err.message);
  }
});

export default router;
