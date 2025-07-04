# CrossChainPay

A cross-chain bulk payment application that allows users to make payments across different blockchain networks.

## Deployment to Vercel

### Prerequisites

- A [Vercel](https://vercel.com) account
- [Node.js](https://nodejs.org/) installed locally
- [Vercel CLI](https://vercel.com/docs/cli) (optional for advanced deployments)

### Environment Variables

Set up the following environment variables in your Vercel project settings:

- `NODE_ENV`: Set to `production` for deployment
- Add any additional API keys or secrets required by your application

### Deployment Steps

1. **Connect your GitHub repository to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure project settings

2. **Configure Build Settings**:
   - Vercel should automatically detect the configuration from `vercel.json`
   - The build command is `npm run vercel-build`
   - The output directory is `dist/public`

3. **Deploy**:
   - Click "Deploy" in the Vercel dashboard
   - Vercel will build and deploy your application

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Project Structure

- `client/`: Frontend React application
- `server/`: Backend Express API
- `shared/`: Shared types and utilities
- `dist/`: Build output (generated during build)

## Technologies

- Frontend: React, TypeScript, Vite, TailwindCSS
- Backend: Express, TypeScript
- Cross-chain: USDC, CCTP (Cross-Chain Transfer Protocol) 