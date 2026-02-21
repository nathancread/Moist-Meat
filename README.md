# Moist Meat

A real-time temperature and humidity monitoring dashboard built with SvelteKit. Stream live sensor data from Firebase and visualize it with interactive charts.

## Features

- **Live Data Streaming**: Real-time updates via Server-Sent Events (SSE) from Firebase Realtime Database
- **Interactive Charts**: Temperature and humidity visualizations using Chart.js
- **Historical Data**: Load and display past readings from a configurable date
- **Server-side Logging**: Comprehensive logging with Pino for debugging and monitoring

## Tech Stack

- **Frontend**: Svelte 5 with TypeScript
- **Backend**: SvelteKit with Node.js
- **Build Tool**: Vite
- **Database**: Firebase Realtime Database
- **Charts**: Chart.js
- **Code Quality**: ESLint + Prettier
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Bun (or npm/yarn/pnpm)
- Firebase account with Realtime Database configured

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Start development server
bun run dev

# Open in browser
bun run dev -- --open
```

The app will be available at `http://localhost:5173`.

### Building for Production

```bash
# Build the app
bun run build

# Preview production build
bun run preview
```

## Configuration

Create a `.env.local` file with your Firebase configuration:

```
# Firebase Admin SDK key (for server-side use)
FIREBASE_KEY=your_firebase_key

# Database reference path
DB_REF_PATH=/sensors/device1

# Cutoff date for loading historical data
CUTOFF_DATE=2024-01-01
```

## API Routes

### `GET /stream`

Server-Sent Events endpoint that streams new sensor readings in real-time.

**Query Parameters:**

- `since` (optional): Timestamp in milliseconds. Only readings strictly after this timestamp are streamed.

**Response Format:**

```json
{
	"key": "reading_id",
	"timestamp": 1704067200000,
	"temperature": 22.5,
	"humidity": 45.3
}
```

## Code Quality

```bash
# Check code with svelte-check and ESLint
bun run check

# Watch mode
bun run check:watch

# Format with Prettier
bun run format

# Lint with ESLint
bun run lint
```

## Project Structure

```
src/
├── lib/
│   ├── charts.ts       # Chart.js configuration
│   ├── config.ts       # Environment configuration
│   ├── firebase.ts     # Firebase initialization
│   ├── logger.ts       # Pino logger setup
│   └── sensor.ts       # Sensor data loading logic
├── routes/
│   ├── +layout.svelte  # Root layout
│   ├── +page.svelte    # Main dashboard
│   ├── +page.server.ts # Server-side data loading
│   └── stream/
│       └── +server.ts  # SSE endpoint
└── app.d.ts            # Global type definitions
```

## Deployment

This project is configured for Vercel deployment. Push to your repository and connect it to Vercel for automatic deployments.

## License

MIT
