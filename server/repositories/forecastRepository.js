const db = require('../db/connection');

function replaceAll(forecasts) {
  const insert = db.prepare(
    'INSERT INTO forecast_cache (horizon, predicted_price, predicted_for_date, model_params) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM forecast_cache').run();
    items.forEach((f) =>
      insert.run(f.horizon, f.predictedPrice, f.predictedForDate, JSON.stringify(f.modelParams || {}))
    );
  });
  tx(forecasts);
}

function latestAll() {
  return db.prepare('SELECT * FROM forecast_cache ORDER BY horizon ASC').all();
}

module.exports = { replaceAll, latestAll };
