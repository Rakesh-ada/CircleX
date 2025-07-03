import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/store/useAppStore';
import { SUPPORTED_CHAINS, TESTNET_CHAINS } from '@/lib/constants';
import { Wallet, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function WalletConnect() {
  const { isConnected, address, chainId, connectWallet, disconnectWallet } = useWallet();
  const { isTestnet, autoRefresh } = useAppStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Update connection status based on wallet state
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected]);

  const handleConnect = async () => {
    setConnectionStatus('connecting');
    try {
      await connectWallet();
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setConnectionStatus('disconnected');
  };

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  // Get current network info
  const supportedChains = isTestnet ? TESTNET_CHAINS : SUPPORTED_CHAINS;
  const currentChain = chainId ? supportedChains.find(chain => chain.id === chainId) : null;
  const networkName = currentChain?.name || (isConnected ? 'Unknown Network' : 'None');
  const isValidChain = currentChain !== null;

  return (
    <div className="flex items-center space-x-3">
      {/* Network Indicator */}
      <div className="glass-input rounded-lg px-4 py-2 border border-white/10">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isValidChain ? 'bg-emerald-400 glow-pulse' : 'bg-red-400'}`}></div>
          <span className="text-sm text-slate-300 font-medium">{networkName}</span>
        </div>
      </div>

      {/* Wallet Connection */}
      {isConnected ? (
        <Button
          variant="outline"
          onClick={handleDisconnect}
          className="glass-button text-white border-blue-400/30 hover:border-blue-400/50 px-4 py-2 rounded-lg backdrop-blur-sm"
        >
          <Wallet className="w-4 h-4 mr-2" />
          {shortAddress}
        </Button>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={connectionStatus === 'connecting'}
          className="glass-button text-white px-6 py-2 rounded-lg backdrop-blur-sm disabled:opacity-50 glow-border"
        >
          {connectionStatus === 'connecting' ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      )}
    </div>
  );
}
