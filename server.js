import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import mongoose, { Schema } from 'mongoose';
import expressListEndpoints from 'express-list-endpoints';
import 'dotenv/config';
import { Configuration, OpenAIApi } from 'openai';

import createRouter from './routes/create.js';
import fetchRouter from './routes/fetchGames.js';
import gameRouter from './routes/games.js';
import reviewRouter from './routes/reviews.js';
import userRouter from './routes/users.js';

require('dotenv').config();

const listEndpoints = expressListEndpoints;

const { OPENAI_API_KEY } = process.env;

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Defines the port the app will run on. Defaults to 8080, but can be overridden

const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

// Adds the Route's file's routes to the application at the root path
app.use('/', fetchRouter);
app.use('/', gameRouter);
app.use('/', reviewRouter);
app.use('/', userRouter);

// Start defining your routes here
app.get('/', (req, res) => {
  const welcomeMessage = 'Final project API';
  const endpoints = listEndpoints(app);

  res.status(200).json({
    success: true,
    message: 'OK',
    body: {
      welcomeMessage,
      endpoints
    }
  });
});

app.post('/create', async (req, res) => {
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
// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
