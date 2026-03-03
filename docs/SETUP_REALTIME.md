# Real-Time Setup & Flow

## Critical: Use Custom Server

**You must run `npm run dev` (which runs `node server.js`)** — not `next dev` directly.

The custom server is required for Socket.io. Without it, `global.io` is undefined and:
- Interpreters never receive offer notifications
- Clients never receive real-time assignment updates

## Flow Summary

1. **Client** clicks "Request Interpreter Now" → fills form → submits
2. **Backend** finds eligible interpreters (status=online, matching language/specialty)
3. **Backend** emits `offer_created` to each matched interpreter via Socket.io
4. **Interpreter** sees the offer in dashboard instantly (if they're connected and Online)
5. **Interpreter** clicks Accept → atomic claim → first-accept wins
6. **Backend** emits `job_assigned` to winner, `offer_revoked` to others, `request_status` to client
7. **Client** and **Interpreter** are auto-redirected to the call page
8. **Call** opens in Daily.co iframe (when DAILY_API_KEY is set)

## Interpreter Must Be Online

Interpreters must set their availability to **Online** via the toggle on their dashboard. Only online interpreters receive offers.

## Daily.co Setup (Optional)

For real video/audio calls:

1. Sign up at https://dashboard.daily.co
2. Create an API key
3. Add to `.env`:
   ```
   DAILY_API_KEY=your_api_key
   DAILY_DOMAIN=your-subdomain
   ```
4. Restart the server
