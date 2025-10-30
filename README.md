# Testero Frontend

AI-powered certification exam preparation platform built with Next.js 15, React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: React 18.3, shadcn/ui, Tailwind CSS
- **Backend**: Supabase (Auth & PostgreSQL)
- **Analytics**: PostHog
- **Infrastructure**: Google Cloud Platform (Cloud Run)
- **Testing**: Jest, Playwright

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker (for local testing)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Development Commands

```bash
# Development server
npm run dev

# Run unit tests
npm test

# Run E2E tests
npm run e2e

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Project Structure

```
app/              # Next.js App Router pages and API routes
components/       # React components organized by feature
lib/             # Business logic and utilities
docs/            # Documentation
├── strategy/    # Product vision, metrics, revenue model
├── deployment/  # Deployment and setup guides
└── development/ # Development guidelines and AI instructions
```

## Documentation

Comprehensive documentation is available in the `/docs` folder:

- **[Documentation Index](./docs/README.md)** - Complete guide to all documentation
- **[CLAUDE.md](./CLAUDE.md)** - Development guidelines for AI assistants
- **[Deployment Guide](./docs/deployment/deployment-guide.md)** - GCP Cloud Run deployment
- **[Product Vision](./docs/strategy/product-vision.md)** - Product strategy and roadmap

## Features

- 🔐 Authentication with Supabase (email/password, anonymous sessions)
- 📊 Diagnostic testing with adaptive recommendations
- 🎯 AI-powered personalized study paths
- 📱 Responsive design with mobile-first approach
- ♿ Accessibility built-in with shadcn/ui
- 🧪 Comprehensive test coverage (unit + E2E)
- 🚀 Production-ready deployment on GCP Cloud Run

## Contributing

This project is currently in active development. For contribution guidelines, please refer to the main project documentation in `/docs`.

## License

Private project - All rights reserved.
