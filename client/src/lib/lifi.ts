import { getRoutes, executeRoute, getStatus, getChains, getTokens, getTools } from '@lifi/sdk';
import type { RoutesRequest, Route, ExecutionData, StatusResponse } from '@lifi/sdk';
import { BrowserProvider } from 'ethers';

export interface LiFiTransferRequest {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
  maxPriceImpact?: number;
  allowBridges?: string[];
  denyBridges?: string[];
  preferredBridges?: string[];
  transferMethod?: 'fast' | 'standard';
}

export interface LiFiTransferResult {
  txHash: string;
  route: Route;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
}

export interface LiFiStatusResult {
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  substatus?: string;
  sendingTxHash?: string;
  receivingTxHash?: string;
  fromChain: number;
  toChain: number;
  bridge?: string;
  tool?: string;
  failureMessage?: string;
}

export class LiFiService {
  private isTestnet: boolean;

  constructor(isTestnet: boolean = false) {
    this.isTestnet = isTestnet;
  }

  /**
   * Get the best route for a cross-chain transfer
   */
  async getRoute(request: LiFiTransferRequest): Promise<Route[]> {
    const routeRequest: RoutesRequest = {
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromTokenAddress: request.fromTokenAddress,
      toTokenAddress: request.toTokenAddress,
      fromAmount: request.fromAmount,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      options: {
        slippage: request.slippage || 0.005, // 0.5%
        bridges: {
          allow: request.allowBridges || (request.transferMethod === 'fast' ? ['cctp'] : ['cctp', 'stargate', 'across']),
          deny: request.denyBridges || [],
        },
        // Prefer CCTP for fast transfers
        order: request.transferMethod === 'fast' ? 'FASTEST' : 'CHEAPEST',
      },
    };

    try {
      const routesResponse = await getRoutes(routeRequest);
      const routes = routesResponse.routes || [];
      
      // Filter routes to prefer CCTP for fast transfers
      if (request.transferMethod === 'fast' && routes.length > 0) {
        const cctpRoutes = routes.filter((route: Route) => 
          route.steps.some((step: any) => 
            step.tool === 'cctp' || step.toolDetails?.name?.toLowerCase().includes('cctp')
          )
        );
        
        if (cctpRoutes.length > 0) {
          return cctpRoutes;
        }
      }

      return routes;
    } catch (error) {
      console.error('Error getting LiFi routes:', error);
      throw new Error(`Failed to get routes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a cross-chain transfer using the selected route
   */
  async executeTransfer(route: Route, signer: any): Promise<LiFiTransferResult> {
    try {
      const execution = await executeRoute(signer, route, {
        updateCallback: (update: any) => {
          console.log('Transfer update:', update);
        },
      });

      return {
        txHash: execution.txHash || '',
        route,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('Error executing LiFi transfer:', error);
      throw new Error(`Failed to execute transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the status of a cross-chain transfer
   */
  async getTransferStatus(
    txHash: string,
    fromChain: number,
    toChain: number,
    bridge?: string
  ): Promise<LiFiStatusResult> {
    try {
      const status = await getStatus({
        txHash,
        bridge: bridge || 'cctp',
        fromChain,
        toChain,
      });

      return {
        status: status.status as 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED',
        substatus: status.substatus,
        sendingTxHash: status.sendingTxHash,
        receivingTxHash: status.receivingTxHash,
        fromChain,
        toChain,
        bridge: bridge || 'cctp',
        tool: status.tool,
        failureMessage: status.errorMessage,
      };
    } catch (error) {
      console.error('Error getting transfer status:', error);
      throw new Error(`Failed to get transfer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported chains for cross-chain transfers
   */
  async getSupportedChains(): Promise<any[]> {
    try {
      const chainsResponse = await getChains();
      const chains = chainsResponse.chains || [];
      return chains.filter((chain: any) => 
        this.isTestnet ? chain.testnet : !chain.testnet
      );
    } catch (error) {
      console.error('Error getting supported chains:', error);
      return [];
    }
  }

  /**
   * Get supported tokens for a specific chain
   */
  async getSupportedTokens(chainId: number): Promise<any[]> {
    try {
      const tokensResponse = await getTokens({ chainId });
      return tokensResponse.tokens || [];
    } catch (error) {
      console.error('Error getting supported tokens:', error);
      return [];
    }
  }

  /**
   * Get available bridges and exchanges
   */
  async getAvailableTools(): Promise<{ bridges: any[], exchanges: any[] }> {
    try {
      const toolsResponse = await getTools();
      return {
        bridges: toolsResponse.bridges || [],
        exchanges: toolsResponse.exchanges || [],
      };
    } catch (error) {
      console.error('Error getting available tools:', error);
      return { bridges: [], exchanges: [] };
    }
  }

  /**
   * Estimate gas costs for a route
   */
  async estimateGasCosts(route: Route): Promise<{
    srcGasCost: string;
    dstGasCost: string;
    totalGasCostUSD: string;
  }> {
    try {
      // Extract gas estimates from the route
      const firstStep = route.steps[0];
      const lastStep = route.steps[route.steps.length - 1];
      
      const srcGasCost = firstStep?.estimate?.gasCosts?.[0]?.amount || '0';
      const dstGasCost = lastStep?.estimate?.gasCosts?.[0]?.amount || '0';
      const totalGasCostUSD = route.gasCostUSD || '0';

      return {
        srcGasCost,
        dstGasCost,
        totalGasCostUSD,
      };
    } catch (error) {
      console.error('Error estimating gas costs:', error);
      return {
        srcGasCost: '0',
        dstGasCost: '0',
        totalGasCostUSD: '0',
      };
    }
  }

  /**
   * Check if CCTP is available for a specific chain pair
   */
  async isCCTPAvailable(fromChainId: number, toChainId: number): Promise<boolean> {
    try {
      const tools = await this.getAvailableTools();
      const cctpBridge = tools.bridges.find((bridge: any) => 
        bridge.key === 'cctp' || bridge.name?.toLowerCase().includes('cctp')
      );
      
      if (!cctpBridge) return false;

      // Check if both chains are supported for CCTP
      const supportedChains = cctpBridge.supportedChains || [];
      return supportedChains.includes(fromChainId) && supportedChains.includes(toChainId);
    } catch (error) {
      console.error('Error checking CCTP availability:', error);
      return false;
    }
  }

  /**
   * Get CCTP fast transfer fee estimate
   */
  async getCCTPFastFee(fromChainId: number, toChainId: number, amount: string): Promise<string> {
    try {
      // CCTP V2 fast transfer fees are minimal
      // For V1, there are typically no fees except gas
      const baseFee = '0'; // No additional fees for standard CCTP
      const percentageFee = '0'; // No percentage fees
      
      return baseFee;
    } catch (error) {
      console.error('Error getting CCTP fast fee:', error);
      return '0';
    }
  }

  /**
   * Update testnet mode
   */
  setTestnet(isTestnet: boolean): void {
    this.isTestnet = isTestnet;
  }
}

export default LiFiService;