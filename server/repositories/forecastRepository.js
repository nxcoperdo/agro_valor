const db = require('../db/connection');

function replaceAll(forecasts) {
  const insert = db.prepare(
    `INSERT INTO forecast_cache
       (granularity, step, predicted_price, low_price, high_price, predicted_for_date, model_params)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM forecast_cache').run();
    items.forEach((f) =>
      insert.run(
        f.granularity,
        f.step,
        f.predictedPrice,
        f.lowPrice ?? null,
        f.highPrice ?? null,
        f.predictedForDate,
        JSON.stringify(f.modelParams || {})
      )
    );
  });
  tx(forecasts);
}

function latestAll() {
  return db
    .prepare(
      "SELECT * FROM forecast_cache ORDER BY CASE granularity WHEN 'day' THEN 0 WHEN 'week' THEN 1 ELSE 2 END ASC, step ASC"
    )
    .all();
}

module.exports = { replaceAll, latestAll };
