import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema({
  name: String,
  cover: {
    url: String
  },
  first_release_date: Number,
  genres: [
    {
      name: String
    }
  ],
  summary: String,
  slug: String,
  involved_companies: [
    {
      company: {
        name: String
      }
    }
  ],
  rating: Number,
  screenshots: [
    {
      url: String
    }
  ],
  platforms: [
    {
      name: String
    }
  ],
  savedFavoriteBy: {
    type: [String],
    default: []
  }
});

const Game = mongoose.model('Game', gameSchema);

export default Game;
