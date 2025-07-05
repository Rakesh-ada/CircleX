import { ethers, BrowserProvider } from 'ethers';
import { MetaMaskSDK } from '@metamask/sdk';
import { SUPPORTED_CHAINS, TESTNET_CHAINS } from './constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export class WalletService {
  private provider: BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private sdk: MetaMaskSDK | null = null;

  constructor() {
    this.initializeSDK();
  }

  private initializeSDK() {
    this.sdk = new MetaMaskSDK({
      dappMetadata: {
        name: 'CCTP Bulk Transfer',
        url: window.location.href,
      },
      preferDesktop: true,
    });
  }

  async connectWallet() {
    try {
      if (!this.sdk) {
        throw new Error('MetaMask SDK not initialized');
      }

      const accounts = await this.sdk.connect();
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      // Get the provider from SDK
      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('Failed to get provider from MetaMask SDK');
      }

      this.provider = new BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();

      const address = accounts[0];
      const network = await this.provider.getNetwork();
      const balance = await this.getUSDCBalance(address);

      return {
        address,
        chainId: Number(network.chainId),
        balance
      };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async switchNetwork(chainId: number) {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added to MetaMask, try to add it
        await this.addNetwork(chainId);
      } else {
        throw error;
      }
    }
  }

  async addNetwork(chainId: number) {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // Find the chain configuration
    const allChains = [...SUPPORTED_CHAINS, ...TESTNET_CHAINS];
    const chain = allChains.find(c => c.id === chainId);
    
    if (!chain) {
      throw new Error('Chain not supported');
    }

    try {
      // Set appropriate native currency based on chain
      let nativeCurrency = {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      };

      // Special cases for chains with different native tokens
      if (chainId === 137 || chainId === 80002) { // Polygon
        nativeCurrency = {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18
        };
      } else if (chainId === 43114 || chainId === 43113) { // Avalanche
        nativeCurrency = {
          name: 'AVAX',
          symbol: 'AVAX',
          decimals: 18
        };
      }

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${chainId.toString(16)}`,
          chainName: chain.name,
          nativeCurrency,
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.blockExplorer]
        }]
      });
    } catch (error) {
      console.error('Failed to add network:', error);
      throw new Error('Failed to add network to MetaMask');
    }
  }

  async getAvailableNetworks(): Promise<number[]> {
    if (!window.ethereum) {
      return [];
    }

    try {
      // Get all available chains from MetaMask
      const chainIds = await window.ethereum.request({
        method: 'wallet_getPermissions'
      });
      
      // For now, we'll return the common chains that are typically available
      // This is a simplified approach - in a real app you might want to check each one
      const commonChains = [1, 137, 42161, 8453, 10, 43114]; // Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche
      return commonChains;
    } catch (error) {
      console.error('Failed to get available networks:', error);
      // Return common mainnet chains as fallback
      return [1, 137, 42161, 8453, 10, 43114];
    }
  }

  async getUSDCBalance(address: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId);
      
      // Find the chain configuration
      const allChains = [...SUPPORTED_CHAINS, ...TESTNET_CHAINS];
      const chain = allChains.find(c => c.id === chainId);
      
      if (!chain) {
        return '0.00';
      }

      // USDC contract ABI for balanceOf function
      const usdcAbi = [
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];

      const usdcContract = new ethers.Contract(chain.usdcAddress, usdcAbi, this.provider);
      const balance = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();
      
      // Convert from wei to human readable format
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return parseFloat(formattedBalance).toFixed(2);
    } catch (error) {
      console.error('Failed to get USDC balance:', error);
      return '0.00';
    }
  }

  getProvider() {
    return this.provider;
  }

  getSigner() {
    return this.signer;
  }
}

export const walletService = new WalletService();
