# Seat Safari

Seat Safari helps students find open study seats and mark their own seat occupied when they sit down. It covers the Central Library and computer labs in Academic Blocks 26, 27, 28, 29, 33, and 34. Occupancy refreshes every 15 seconds; the app does not offer reservations.

## Features

- Browse buildings, floors, areas, and individual seat availability.
- Check in and out using the seat controls or a seat-specific QR code.
- Automatically release occupancy after 90 minutes and prompt students to scan again if they are still using the seat.
- Close Academic Block lab check-ins after 7:00 PM while allowing checkout.
- Send a suggestion, complaint, technical issue, or general feedback from the page footer.
- Use responsive layouts and light or dark themes.

## Configured spaces

### Central Library

The five floors are configured for 100 seats each. The basement is an open discussion area; Floor 2 has charging tables and a separate quiet reading area; Floor 3 contains computer labs; Floors 4 and 5 contain Areas A and B and discussion rooms for groups of 5 or 10.

The per-area counts on Floor 2 and in Areas A/B on Floors 4 and 5 are provisional allocations because actual seat counts were not supplied. Confirm them before printing QR labels.

### Academic Blocks

Each listed block has six 40-seat computer labs on Floor 3 and is configured to close at 7:00 PM India time. Verify room names, capacities, and operating hours against campus records before operational use.

## Run locally

Requirements: Node.js 22.5 or newer (the server uses the built-in `node:sqlite` module) and npm.

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3001](http://localhost:3001). The server initializes and seeds the local SQLite database on startup. By default, it listens on port `3001` and stores data in `server/data/safari.db`.

Optional environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3001` |
| `SAFARI_DB_PATH` | SQLite database path | `server/data/safari.db` |
| `JWT_SECRET` | Signing key for authentication tokens | Local development only; required in production |

Never commit `.env` files, database files, QR exports containing real location details, or real occupancy data. Supply a strong unique `JWT_SECRET` through the hosting provider's secret manager.

## QR and occupancy notes

Seat status is self-reported; a static QR label identifies a seat but does not verify that someone is physically present. QR codes intended for phones must point to a campus-reachable URL. Academic Block occupancy clears when the API next handles a request after closing time.

## Project documents

- [User flow diagram](docs/seat-safari-user-flow.md) · [PDF](output/pdf/seat-safari-user-flow.pdf)
- [Usability test plan and results](docs/seat-safari-test-plan.md) · [PDF](output/pdf/seat-safari-test-plan.pdf)

## Hosting

The Vercel deployment uses the Express API as a Node.js Function and serves the Vite client as static assets. Live occupancy and feedback are stored in Neon Postgres; the local SQLite database is for local development only and is not migrated or deployed. Set `DATABASE_URL` in Vercel from the connected Neon integration before publishing a production deployment.

## License

This project is available under the [ISC License](LICENSE).
