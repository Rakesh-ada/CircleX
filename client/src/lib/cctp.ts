import { ethers, BrowserProvider, Contract, parseUnits, formatEther, formatUnits } from 'ethers';
import { CCTP_V2_CONTRACTS, CCTP_V2_TESTNET_CONTRACTS, SUPPORTED_CHAINS, TESTNET_CHAINS } from './constants';
import { Recipient } from '@/types';

// Circle API response interfaces
interface AttestationResponse {
  data: {
    attestation: string;
    status: 'complete' | 'pending_confirmations';
  };
}

interface MessageResponse {
  messages: Array<{
    message: string;
    eventNonce: string;
    attestation: string;
    status: 'complete' | 'pending_confirmations';
    cctpVersion: number;
    decodedMessage?: {
      sourceDomain: string;
      destinationDomain: string;
      nonce: string;
      sender: string;
      recipient: string;
      messageBody: string;
    };
  }>;
}

interface PublicKeysResponse {
  publicKeys: Array<{
    publicKey: string;
    cctpVersion: string;
  }>;
}

interface FastBurnAllowanceResponse {
  allowance: string;
}

interface BurnFeesResponse {
  fees: Array<{
    feeType: 'fast' | 'standard';
    fee: string;
  }>;
}

interface CircleBurnFeesResponse {
  finalityThreshold: number;
  minimumFee: number;
}

export class CCTPService {
  private provider: BrowserProvider;
  private signer: ethers.Signer;
  private isTestnet: boolean;

  constructor(provider: BrowserProvider, signer: ethers.Signer, isTestnet: boolean = false) {
    this.provider = provider;
    this.signer = signer;
    this.isTestnet = isTestnet;
  }

  private getApiBaseUrl(): string {
    return this.isTestnet 
      ? 'https://iris-api-sandbox.circle.com'
      : 'https://iris-api.circle.com';
  }

  private getContracts() {
    return this.isTestnet ? CCTP_V2_TESTNET_CONTRACTS : CCTP_V2_CONTRACTS;
  }

  private getSupportedChains() {
    return this.isTestnet ? TESTNET_CHAINS : SUPPORTED_CHAINS;
  }

  async burnUSDC(recipient: Recipient, destinationChain: number, transferMethod: 'fast' | 'standard'): Promise<string> {
    try {
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId);
      const supportedChains = this.getSupportedChains();
      const sourceChain = supportedChains.find(c => c.id === chainId);
      
      console.log('Current chain ID:', chainId);
      console.log('Source chain:', sourceChain);
      console.log('Is testnet:', this.isTestnet);
      
      // Check if we're on mainnet vs testnet mismatch
      const isMainnet = chainId === 1 || chainId === 137 || chainId === 42161 || chainId === 8453 || chainId === 10 || chainId === 43114;
      const isTestnet = chainId === 11155111 || chainId === 421614 || chainId === 84532;
      
      if (isMainnet && this.isTestnet) {
        throw new Error('Network mismatch: You are connected to a mainnet but the app is set to testnet mode. Please switch to testnet mode or connect to a testnet network.');
      }
      
      if (isTestnet && !this.isTestnet) {
        throw new Error('Network mismatch: You are connected to a testnet but the app is set to mainnet mode. Please switch to mainnet mode or connect to a mainnet network.');
      }
      
      if (!sourceChain) {
        throw new Error(`Unsupported source chain: ${chainId}. Supported chains: ${supportedChains.map(c => c.name).join(', ')}`);
      }

      const destChain = supportedChains.find(c => c.id === destinationChain);
      if (!destChain) {
        throw new Error(`Unsupported destination chain: ${destinationChain}`);
      }

      // Prevent same-domain transfers (CCTP doesn't support transfers within the same domain)
      if (sourceChain.cctpDomain === destChain.cctpDomain) {
        throw new Error(`Cannot transfer to the same chain domain. Source chain "${sourceChain.name}" and destination chain "${destChain.name}" both use CCTP domain ${sourceChain.cctpDomain}. Please select a different destination chain.`);
      }

      const contracts = this.getContracts();
      const amount = parseUnits(recipient.amount, 6);
      
      console.log('Burn amount:', amount.toString());
      console.log('Destination chain:', destChain.name);
      console.log('CCTP domain:', destChain.cctpDomain);

      // USDC contract ABI
      const usdcAbi = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)'
      ];

      const usdcContract = new Contract(sourceChain.usdcAddress, usdcAbi, this.signer);
      const signerAddress = await this.signer.getAddress();

      // Check USDC balance first
      const balanceAbi = ['function balanceOf(address account) view returns (uint256)'];
      const balanceContract = new Contract(sourceChain.usdcAddress, balanceAbi, this.provider);
      const balance = await balanceContract.balanceOf(signerAddress);
      
      console.log('USDC balance:', ethers.formatUnits(balance, 6));
      console.log('Required amount:', ethers.formatUnits(amount, 6));
      
      if (balance < amount) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.formatUnits(balance, 6)} USDC but need ${ethers.formatUnits(amount, 6)} USDC`);
      }

      // Check and approve TokenMessengerV2
      const allowance = await usdcContract.allowance(signerAddress, contracts.tokenMessengerV2);
      console.log('Current allowance:', ethers.formatUnits(allowance, 6));

      if (allowance < amount) {
        console.log('Approving TokenMessengerV2 for amount:', ethers.formatUnits(amount, 6));
        const approveTx = await usdcContract.approve(contracts.tokenMessengerV2, amount);
        await approveTx.wait();
        console.log('Approval transaction completed');
      }

      // TokenMessengerV2 ABI for CCTP V2 - Updated with correct signatures
      const tokenMessengerV2Abi = [
        'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)',
        'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes calldata hookData) external returns (uint64 nonce)'
      ];

      const tokenMessengerV2 = new Contract(
        contracts.tokenMessengerV2,
        tokenMessengerV2Abi,
        this.signer
      );

      const mintRecipient = ethers.zeroPadValue(recipient.address, 32);
      const destinationCaller = ethers.zeroPadValue('0x0000000000000000000000000000000000000000', 32); // Anyone can call receiveMessage
      
      let burnTx;
      if (transferMethod === 'fast') {
        // Fast Transfer: minFinalityThreshold ≤ 1000, maxFee covers Fast Transfer fee (currently 0 bps = 0%)
        const maxFee = parseUnits('0.01', 6); // Small maxFee for Fast Transfer (0.01 USDC)
        const minFinalityThreshold = 1000; // Fast Transfer threshold (confirmed level)
        
        console.log('Calling depositForBurn for Fast Transfer with params:', {
          amount: amount.toString(),
          destinationDomain: destChain.cctpDomain,
          mintRecipient: mintRecipient,
          burnToken: sourceChain.usdcAddress,
          destinationCaller: destinationCaller,
          maxFee: maxFee.toString(),
          minFinalityThreshold
        });
        
        burnTx = await tokenMessengerV2.depositForBurn(
          amount,
          destChain.cctpDomain,
          mintRecipient,
          sourceChain.usdcAddress,
          destinationCaller,
          maxFee,
          minFinalityThreshold
        );
      } else {
        // Standard Transfer: minFinalityThreshold = 2000, maxFee = 0 (no fee)
        const maxFee = 0; // Standard Transfer has no fee
        const minFinalityThreshold = 2000; // Standard Transfer threshold (finalized level)
        
        console.log('Calling depositForBurn for Standard Transfer with params:', {
          amount: amount.toString(),
          destinationDomain: destChain.cctpDomain,
          mintRecipient: mintRecipient,
          burnToken: sourceChain.usdcAddress,
          destinationCaller: destinationCaller,
          maxFee,
          minFinalityThreshold
        });
        
        burnTx = await tokenMessengerV2.depositForBurn(
          amount,
          destChain.cctpDomain,
          mintRecipient,
          sourceChain.usdcAddress,
          destinationCaller,
          maxFee,
          minFinalityThreshold
        );
      }

      const receipt = await burnTx.wait();
      console.log('Burn transaction successful:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error('Burn failed:', error);
      
      // Enhanced error handling with specific error details
      const err = error as any;
      
      // Handle user rejection gracefully
      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || 
          (err.message && err.message.includes('user denied')) ||
          (err.message && err.message.includes('User denied'))) {
        throw new Error('Transaction cancelled by user');
      } else if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error(`Transaction will likely fail. This could be due to:\n- Insufficient USDC balance\n- Insufficient ETH for gas\n- Incorrect contract address\n- Invalid function parameters\n\nOriginal error: ${err.message}`);
      } else if (err.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient funds for transaction. Please check your ETH balance for gas fees.`);
      } else if (err.message?.includes('revert')) {
        throw new Error(`Smart contract reverted: ${err.message}`);
      } else {
        throw new Error(`Transaction failed: ${err.message || err}`);
      }
    }
  }

  async getMessagesAndAttestation(txHash: string, sourceChainId: number): Promise<MessageResponse> {
    try {
      const supportedChains = this.getSupportedChains();
      const sourceChain = supportedChains.find(c => c.id === sourceChainId);
      
      if (!sourceChain) {
        throw new Error('Unsupported source chain');
      }

      const apiUrl = `${this.getApiBaseUrl()}/v2/messages/${sourceChain.cctpDomain}?transactionHash=${txHash}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: MessageResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get messages and attestation:', error);
      throw error;
    }
  }

  async getAttestation(messageHash: string): Promise<string> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/v1/attestations/${messageHash}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Attestation API request failed: ${response.status} ${response.statusText}`);
      }

      const data: AttestationResponse = await response.json();
      
      if (data.data.status !== 'complete') {
        throw new Error('Attestation not ready');
      }

      return data.data.attestation;
    } catch (error) {
      console.error('Failed to get attestation:', error);
      throw error;
    }
  }

  async reattest(nonce: string): Promise<void> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/v2/reattest/${nonce}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Reattest API request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to reattest:', error);
      throw error;
    }
  }

  async mintUSDC(message: string, attestation: string, destinationChainId: number): Promise<string> {
    try {
      const network = await this.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      // Automatically switch to destination chain if different
      if (currentChainId !== destinationChainId) {
        console.log(`Switching from chain ${currentChainId} to destination chain ${destinationChainId}`);
        
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed');
        }

        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${destinationChainId.toString(16)}` }]
          });
          
          // Wait a moment for the network switch to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Refresh provider and signer after network switch
          this.provider = new BrowserProvider(window.ethereum);
          this.signer = await this.provider.getSigner();
          
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            throw new Error(`Destination chain ${destinationChainId} not added to MetaMask. Please add it manually.`);
          }
          throw new Error(`Failed to switch to destination chain: ${switchError.message}`);
        }
      }

      const contracts = this.getContracts();
      const messageTransmitterV2Abi = [
        'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success)'
      ];

      const messageTransmitterV2 = new Contract(
        contracts.messageTransmitterV2,
        messageTransmitterV2Abi,
        this.signer
      );

      const mintTx = await messageTransmitterV2.receiveMessage(message, attestation);
      const receipt = await mintTx.wait();
      
      return receipt.hash;
    } catch (error) {
      console.error('Mint failed:', error);
      throw error;
    }
  }

  async getFastBurnAllowance(): Promise<string> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/v2/fastBurn/USDC/allowance`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Fast burn allowance API request failed: ${response.status} ${response.statusText}`);
      }

      const data: FastBurnAllowanceResponse = await response.json();
      return data.allowance;
    } catch (error) {
      console.error('Failed to get fast burn allowance:', error);
      throw error;
    }
  }

  async getBurnFees(sourceChainId: number, destinationChainId: number): Promise<BurnFeesResponse> {
    try {
      const supportedChains = this.getSupportedChains();
      const sourceChain = supportedChains.find(c => c.id === sourceChainId);
      const destChain = supportedChains.find(c => c.id === destinationChainId);
      
      if (!sourceChain || !destChain) {
        throw new Error('Unsupported chain');
      }

      const apiUrl = `${this.getApiBaseUrl()}/v2/burn/USDC/fees/${sourceChain.cctpDomain}/${destChain.cctpDomain}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Burn fees API request failed: ${response.status} ${response.statusText}`);
      }

      const circleData: CircleBurnFeesResponse[] = await response.json();
      
      // Transform Circle's response format to our expected format
      const transformedFees: BurnFeesResponse = {
        fees: circleData.map((item, index) => ({
          feeType: item.finalityThreshold >= 2000 ? 'standard' : 'fast',
          fee: (item.minimumFee / 1000000).toFixed(2) // Convert from micro-USDC to USDC
        }))
      };

      return transformedFees;
    } catch (error) {
      console.error('Failed to get burn fees:', error);
      throw error;
    }
  }

  async getPublicKeys(): Promise<PublicKeysResponse> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/v2/publicKeys?cctpVersion=2`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Public keys API request failed: ${response.status} ${response.statusText}`);
      }

      const data: PublicKeysResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get public keys:', error);
      throw error;
    }
  }

  async estimateFees(recipients: Recipient[], transferMethod: 'fast' | 'standard'): Promise<{
    networkFees: string;
    cctpFees: string;
    total: string;
  }> {
    try {
      // Check if provider is still valid before making calls
      let networkFeesUSD = 5; // Default fallback in USD
      try {
        const feeData = await this.provider.getFeeData();
        const gasPrice = feeData.gasPrice || parseUnits('20', 'gwei');
        
        // Estimate network fees in USD
        // Typical transfer uses ~21,000 gas for USDC transfer
        const estimatedGasUsed = 21000n * BigInt(recipients.length);
        const totalGasCost = gasPrice * estimatedGasUsed;
        
        // Convert to USD (rough estimate: 1 ETH = $2000, 1 gwei = 1e-9 ETH)
        const ethCost = Number(formatUnits(totalGasCost, 'ether'));
        networkFeesUSD = ethCost * 2000; // Rough ETH price estimate
      } catch (networkError: any) {
        // Handle network change errors gracefully
        if (networkError.code === 'NETWORK_ERROR' || networkError.event === 'changed') {
          console.warn('Network change detected during fee estimation, using fallback for network fees');
        } else {
          console.warn('Could not fetch network fees, using fallback:', networkError);
        }
      }

      // Get real CCTP fees if possible
      let cctpFeesUSD = 0;
      if (recipients.length > 0) {
        try {
          const network = await this.provider.getNetwork();
          const sourceChainId = Number(network.chainId);
          const uniqueDestinations = Array.from(new Set(recipients.map(r => r.chainId)));
          
          for (const destChainId of uniqueDestinations) {
            if (destChainId !== sourceChainId) {
              const feesData = await this.getBurnFees(sourceChainId, destChainId);
              const relevantFee = feesData.fees.find(f => f.feeType === transferMethod);
              if (relevantFee) {
                const recipientsForChain = recipients.filter(r => r.chainId === destChainId);
                cctpFeesUSD += parseFloat(relevantFee.fee) * recipientsForChain.length;
              }
            }
          }
        } catch (error: any) {
          // Handle network change errors gracefully
          if (error.code === 'NETWORK_ERROR' || error.event === 'changed') {
            console.warn('Network change detected during CCTP fee estimation, using fallback');
          } else {
            console.warn('Could not fetch real CCTP fees, using fallback:', error);
          }
          // Fallback fee estimation
          cctpFeesUSD = transferMethod === 'fast' ? recipients.length * 0.5 : 0;
        }
      }

      const total = networkFeesUSD + cctpFeesUSD;

      return {
        networkFees: `~$${networkFeesUSD.toFixed(2)}`,
        cctpFees: `~$${cctpFeesUSD.toFixed(2)}`,
        total: `~$${total.toFixed(2)}`
      };
    } catch (error: any) {
      // Handle network change errors gracefully
      if (error.code === 'NETWORK_ERROR' || error.event === 'changed') {
        console.warn('Network change detected during fee estimation, using fallback');
      } else {
        console.error('Fee estimation failed:', error);
      }
      
      // Fallback estimation
      return {
        networkFees: '~$15.00',
        cctpFees: transferMethod === 'fast' ? '~$5.00' : '~$0.00',
        total: transferMethod === 'fast' ? '~$20.00' : '~$15.00'
      };
    }
  }
}
