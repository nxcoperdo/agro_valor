# AgroValor

Coffee price tracking platform for farmers and buyers in Colombia: a web app and REST API, plus a Flutter mobile client in `mobile/`.

## What it does

- Tracks coffee prices, the COP exchange rate, the FNC reference price and NY coffee prices.
- Price calculator, price forecast and reports (PDF export).
- Price alerts with push notifications.
- Cooperatives directory, sales records, and business accounts with plans.
- Admin routes and scheduled jobs that refresh prices.

## Stack

- **Backend:** Node.js, Express, SQLite, JWT auth, node-cron, cheerio, pdfkit, firebase-admin.
- **Web front end:** vanilla JavaScript, Chart.js, webpack, service worker.
- **Mobile:** Flutter (`mobile/`).

## How to run

1. `cp .env.example .env` and fill in your own values.
2. `npm install`
3. `npm run seed` to create and seed the SQLite database.
4. `npm run dev` to start backend and front end.

Other scripts: `npm run build`, `npm start`, `npm test`.
