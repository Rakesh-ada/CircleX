import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { useWallet } from '@/hooks/useWallet';
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { useState } from 'react';

export default function BalanceDisplay() {
  const { wallet, recipients, isTestnet, autoRefresh } = useAppStore();
  const { updateWalletData } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalNeeded = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  const currentBalance = parseFloat(wallet.balance || '0');
  const hasSufficientBalance = currentBalance >= totalNeeded;

  const handleRefresh = async () => {
    if (!wallet.isConnected) return;
    
    setIsRefreshing(true);
    try {
      await updateWalletData();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gradient">Wallet Balance</h2>
          <div className="flex items-center space-x-2">
            {autoRefresh && (
              <div className="w-2 h-2 bg-emerald-400 rounded-full glow-pulse" title="Auto-refresh enabled"></div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={!wallet.isConnected || isRefreshing}
              className="h-8 w-8 p-0 glass-input rounded-lg text-slate-400 hover:text-white border-0"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-slate-400 text-sm">Your available USDC balance</p>
      </div>

      <div className="glass-input rounded-xl p-6 text-center mb-4">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Wallet className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="text-4xl font-bold mb-2 text-gradient">
          {currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-slate-400 text-sm font-medium">USDC Available</div>
      </div>
          
      {recipients.length > 0 && (
        <div className="glass-input rounded-xl p-4 mb-4">
          <div className="text-sm text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Total needed:</span>
              <span className="text-white">{totalNeeded.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className={currentBalance - totalNeeded >= 0 ? 'text-green-400' : 'text-red-400'}>
                {(currentBalance - totalNeeded).toFixed(2)} USDC
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className={`glass-input rounded-xl p-4 text-sm font-medium flex items-center justify-center space-x-2 mb-4 ${
        hasSufficientBalance
          ? 'border-emerald-500/30 text-emerald-400'
          : 'border-red-500/30 text-red-400'
      }`}>
        {hasSufficientBalance ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Sufficient Balance</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Insufficient Balance</span>
          </>
        )}
      </div>
      
      {/* Testnet USDC Faucet Helper */}
      {isTestnet && currentBalance === 0 && (
        <div className="glass-input rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-3 text-center">Need testnet USDC?</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full glass-button text-blue-300 border-blue-500/30 hover:border-blue-400/50"
            onClick={() => window.open('https://faucet.circle.com/', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Get Testnet USDC
          </Button>
        </div>
      )}
    </div>
  );
}
