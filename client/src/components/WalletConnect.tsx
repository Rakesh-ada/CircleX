import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/store/useAppStore';
import { SUPPORTED_CHAINS, TESTNET_CHAINS } from '@/lib/constants';
import { Wallet, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { walletService } from '@/lib/wallet';

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

  const handleSwitchNetwork = async (chainId: number) => {
    try {
      await walletService.switchNetwork(chainId);
      // The wallet hook will automatically update the chain state
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      // Show user-friendly error message
      if (error.message.includes('User rejected')) {
        console.log('User cancelled network switch');
      } else if (error.message.includes('Chain not supported')) {
        console.log('This network is not supported');
      } else {
        console.log('Failed to switch network. Please try again.');
      }
    }
  };

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  // Get current network info
  const supportedChains = isTestnet ? TESTNET_CHAINS : SUPPORTED_CHAINS;
  const currentChain = chainId ? supportedChains.find(chain => chain.id === chainId) : null;
  const networkName = currentChain?.name || (isConnected ? 'Unknown Network' : 'None');
  const isValidChain = currentChain !== null;

  // Filter to show only commonly available networks or add option to add new ones
  const availableChains = supportedChains.filter(chain => {
    // For mainnet, show common chains that are typically available
    if (!isTestnet) {
      const commonMainnetChains = [1, 137, 42161, 8453, 10, 43114]; // Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche
      return commonMainnetChains.includes(chain.id);
    }
    // For testnet, show common testnet chains
    const commonTestnetChains = [11155111, 80002, 421614, 84532, 11155420, 43113]; // Sepolia, Polygon Amoy, Arbitrum Sepolia, Base Sepolia, OP Sepolia, Avalanche Fuji
    return commonTestnetChains.includes(chain.id);
  });

  return (
    <div className="flex items-center space-x-3">
      {/* Network Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="glass-input rounded-lg px-4 py-2 border border-white/10 hover:border-white/20 transition-colors"
            disabled={!isConnected}
          >
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isValidChain ? 'bg-emerald-400 glow-pulse' : 'bg-red-400'}`}></div>
              <span className="text-sm text-slate-300 font-medium">{networkName}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="glass-card border-white/10 bg-slate-900/90 backdrop-blur-sm">
          {availableChains.map((chain) => (
            <DropdownMenuItem
              key={chain.id}
              onClick={() => handleSwitchNetwork(chain.id)}
              className="cursor-pointer hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: chain.color }}
                ></div>
                <span>{chain.name}</span>
                {chainId === chain.id && (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 ml-auto"></div>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Wallet Connection */}
      {isConnected ? (
        <Button
          variant="outline"
          onClick={handleDisconnect}
          className="glass-button text-white border-blue-400/30 hover:border-blue-400/50 px-4 py-2 rounded-lg backdrop-blur-sm"
          title={`Disconnect ${shortAddress}`}
        >
          <Wallet className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">{shortAddress}</span>
        </Button>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={connectionStatus === 'connecting'}
          className="glass-button text-white px-6 py-2 rounded-lg backdrop-blur-sm disabled:opacity-50 glow-border"
          title={connectionStatus === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
        >
          {connectionStatus === 'connecting' ? (
            <>
              <div className="w-4 h-4 md:mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="hidden md:inline">Connecting...</span>
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Connect Wallet</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
