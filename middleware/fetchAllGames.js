// Populate database with games from IGDB API
// Note that this will populate the database with all the games, which will take a while to complete. It is recommended to run this script in a separate terminal window. You can also change the batchSize and totalGames variables to fetch a smaller number of games. Do this only once, after which you can comment out this script. Or set some kind of authentication so that only you can run this code.

const fetchAndSaveGames = async (offset, batchSize) => {
  try {
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Authorization': process.env.IGDB_CLIENT_SECRET,
        'Client-ID': process.env.IGDB_CLIENT_ID,
        Accept: 'application/json'
      },
      body: `fields name, cover.url, first_release_date, platforms.name, genres.name, summary, slug, involved_companies.company.name, rating, screenshots.url; where platforms = 52; limit ${batchSize}; offset ${offset};`
    });
    const games = await response.json();
    console.log(games);

    // Save each game to the database
    for (const game of games) {
      const ratingResponse = await fetch(
        'https://api.igdb.com/v4/game_ratings',
        {
          method: 'POST',
          headers: {
            'Authorization': process.env.IGDB_CLIENT_SECRET,
            'Client-ID': process.env.IGDB_CLIENT_ID,
            Accept: 'application/json'
          },
          body: `fields rating; where game = ${game.id}; limit 1; sort rating desc;`
        }
      );
      const ratingData = await ratingResponse.json();
      const rating = ratingData.length > 0 ? ratingData[0].rating : 0;

      const gameWithRating = { ...game, rating };
      await new Game(gameWithRating).save();
    }

    return games.length; // Return the number of games fetched in this batch
  } catch (error) {
    console.error(error);
    return 0;
  }
};

const fetchAllGames = async () => {
  const batchSize = 1; // Number of games to fetch in each batch
  const totalGames = 10000; // Total number of games to fetch

  const delay = 250; // Delay in milliseconds (4 requests per second)
  let offset = 0; // Initial offset

  try {
    let totalCount = 0;
    let fetchedCount = 0;

    while (totalCount < totalGames) {
      fetchedCount = await fetchAndSaveGames(offset, batchSize);
      totalCount += fetchedCount;
      offset += batchSize;

      // Delay between API calls
      if (totalCount < totalGames) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(`Total games fetched and saved: ${totalCount}`);
  } catch (error) {
    console.error(error);
  }
};

export default fetchAllGames;
