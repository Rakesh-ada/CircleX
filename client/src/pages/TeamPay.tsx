
import WalletConnect from '@/components/WalletConnect';
import TransferMethodSelector from '@/components/TransferMethodSelector';
import RecipientManager from '@/components/RecipientManager';
import TransactionStatus from '@/components/TransactionStatus';
import PaymentSummary from '@/components/PaymentSummary';
import FeeEstimation from '@/components/FeeEstimation';
import BalanceDisplay from '@/components/BalanceDisplay';
import SettingsPanel from '@/components/SettingsPanel';
import { useAppStore } from '@/store/useAppStore';
import { AlertTriangle } from 'lucide-react';

export default function TeamPay() {
  const { recipients, wallet, isTestnet } = useAppStore();

  // Check for network compatibility issues
  const isMainnet = wallet.chainId === 1 || wallet.chainId === 137 || wallet.chainId === 42161 || wallet.chainId === 8453 || wallet.chainId === 10 || wallet.chainId === 43114;
  const isTestnetChain = wallet.chainId === 11155111 || wallet.chainId === 421614 || wallet.chainId === 84532 || wallet.chainId === 43113 || wallet.chainId === 11155420 || wallet.chainId === 80002 || wallet.chainId === 59901 || wallet.chainId === 713715 || wallet.chainId === 1301 || wallet.chainId === 4801;
  const hasNetworkMismatch = wallet.isConnected && ((isMainnet && isTestnet) || (isTestnetChain && !isTestnet));

  return (
    <div className="min-h-screen gradient-mesh relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl floating-animation-delayed"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl floating-animation"></div>
      </div>
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gradient">
                  <path 
                    d="M12 2L20 7V17L12 22L4 17V7L12 2Z" 
                    stroke="url(#gradient)" 
                    strokeWidth="2" 
                    fill="none"
                  />
                  <circle cx="12" cy="12" r="3" fill="url(#gradient)"/>
                  <path 
                    d="M12 9V5M12 19V15M15 12H19M5 12H9" 
                    stroke="url(#gradient)" 
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="50%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">CircleX</h1>
                <p className="text-slate-400 text-sm hidden sm:block">Cross-Chain Payment Management</p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>
      {/* Network Mismatch Warning */}
      {hasNetworkMismatch && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-10">
          <div className="glass-card rounded-xl p-4 border-yellow-500/20 glow-border">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0" />
              <div>
                <p className="text-yellow-300 font-medium">Network Configuration Mismatch</p>
                <p className="text-yellow-200/80 text-sm mt-1">
                  Your wallet is connected to {isMainnet ? 'Mainnet' : 'Testnet'} but the app is configured for {isTestnet ? 'Testnet' : 'Mainnet'}. 
                  Please switch the network mode in settings or connect to the appropriate network.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transfer Method Selector */}
            <div className="glass-card rounded-xl shimmer">
              <TransferMethodSelector />
            </div>

            {/* Recipient Manager */}
            <RecipientManager />

            {/* Fee Estimation and Settings Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fee Estimation */}
              <div className="glass-card rounded-xl shimmer">
                <FeeEstimation />
              </div>

              {/* Settings Panel */}
              <div className="glass-card rounded-xl shimmer">
                <SettingsPanel />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="glass-card rounded-xl shimmer">
              <PaymentSummary />
            </div>

            {/* Balance Display */}
            <div className="glass-card rounded-xl shimmer">
              <BalanceDisplay />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}