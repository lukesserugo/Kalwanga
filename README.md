# POS System - Monorepo

A comprehensive Point of Sale system with monorepo architecture.

## Project Structure
- packages/backend/ - Express API with Prisma
- packages/mobile/ - Expo React Native app
- packages/web/ - Next.js web app
- packages/desktop/ - Electron desktop app
- packages/shared/ - Shared types and utilities
- docker/ - Docker configurations

## Getting Started
1. Install dependencies: pnpm install
2. Copy environment: cp .env.example .env
3. Start with Docker: pnpm docker:up
4. Run in dev mode: pnpm dev

