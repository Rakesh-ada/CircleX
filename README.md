
# CircleX

A modern cross-chain USDC payment manager built on Circle's CCTP V2 that enables seamless bulk USDC transfers across multiple blockchain networks from a single glassmorphic interface.

## 🌟 Features

- **Cross-Chain USDC Transfers**: Send USDC across 11+ blockchain networks
- **Bulk Payment Processing**: CSV upload for multiple recipients with intelligent batching
- **Real-Time Transaction Tracking**: Live status monitoring with auto-refresh
- **Glassmorphic UI**: Modern design with backdrop blur effects and smooth animations
- **Multi-Chain Balance View**: Monitor USDC balances across all supported networks
- **Mobile Responsive**: Optimized interface for all device sizes
- **🔮 Coming Soon**: MetaMask Delegation toolkit integration

## 🚀 Supported Networks

### Mainnet Chains
- Ethereum, Arbitrum, Optimism, Avalanche, Polygon, Base

### Testnet Chains (11 total)
- Avalanche Fuji, OP Sepolia, Polygon Amoy, Linea Sepolia
- Sonic Testnet, Unichain Sepolia, World Chain Sepolia
- And more for comprehensive testing

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS
- **UI Components**: Radix UI with glassmorphic design
- **Backend**: Node.js + Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: Zustand with persistence
- **Wallet Integration**: MetaMask SDK
- **Deployment**: Vercel, Replit ready

## 🔧 Quick Start

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/circlex.git
cd circlex
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
# Configure DATABASE_URL and other required variables
```

4. **Run database migrations**:
```bash
npm run db:push
```

5. **Start development server**:
```bash
npm run dev
```

6. **Open**: [http://localhost:5000](http://localhost:5000)

## 📊 CSV Upload Format

```csv
recipient_address,amount,destination_chain,description
0x123...,100.50,arbitrum,Team payment Q1
0x456...,250.00,optimism,Vendor invoice #123
0x789...,75.25,avalanche,Freelancer payment
```

## 🏗️ Project Structure

```
circlex/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilities
├── server/               # Express backend
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Data layer
│   └── vite.ts           # Dev server
├── shared/               # Shared types
│   └── schema.ts         # Database schema
├── api/                  # Vercel API routes
└── dist/                 # Build output
```

## 🔐 Security Features

- **Non-Custodial**: Funds remain in user wallets
- **CCTP Security**: Circle's proven cross-chain infrastructure
- **Transaction Verification**: On-chain verification for all transfers
- **Real-time Monitoring**: Live transaction status updates

## 📈 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema
- `npm run check` - TypeScript type checking

## 🌟 Key Features in Detail

### Glassmorphic Design
- Modern UI with backdrop blur effects
- Gradient backgrounds with floating animations
- Responsive design optimized for all devices
- Accessibility-focused with proper ARIA labels

### Intelligent Batching
- Same-chain transfers batched in single transactions
- Cross-chain transfers grouped by destination
- Parallel processing with staggered execution
- Comprehensive error handling with user cancellation

### Real-time Updates
- Auto-refresh wallet balances every 10 seconds
- Live transaction monitoring every 15 seconds
- Real-time activity feed with status indicators
- Connection status with visual feedback

## 🔮 Upcoming Features

### MetaMask Delegation Integration
- **Gasless Transactions**: Delegated gas payments
- **Enhanced Batch Processing**: Multiple transactions, single signature
- **Permission Management**: Fine-grained control over delegated actions
- **Improved UX**: Smoother bulk payment experience

### Roadmap
- [ ] MetaMask Delegation toolkit integration
- [ ] Additional blockchain network support
- [ ] Advanced analytics dashboard
- [ ] Recurring payment automation
- [ ] Mobile app development
- [ ] API documentation portal

## 🚀 Deployment

### Vercel Deployment
```bash
# Deploy to Vercel
vercel --prod
```

### Replit Deployment
- Project is pre-configured for Replit
- Simply run in Replit environment

### Manual Deployment
```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/rakesh.ada/circle-x/issues)
- **Documentation**: [Coming soon]
- **Community**: [Discord server coming soon]

## ⚠️ Important Notes

- Currently in development - transfer execution functionality being rebuilt
- Test thoroughly on testnets before mainnet usage
- Always verify transaction details before confirming
- Keep your wallet secure and never share private keys

---

**CircleX** - Cross-chain payments, simplified. 🚀

*Built with modern web technologies and Circle's CCTP V2*
```

Thanks for the correction! The README now properly reflects **CircleX** as the project name throughout.
