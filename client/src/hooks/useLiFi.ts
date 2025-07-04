import { useState, useEffect, useCallback } from 'react';
import { LiFiService, type LiFiTransferRequest, type LiFiTransferResult, type LiFiStatusResult } from '../lib/lifi';
import { useAppStore } from '../store/useAppStore';
import { walletService } from '../lib/wallet';
import { type Route } from '@lifi/sdk';

export interface UseLiFiHook {
  // Service instance
  lifiService: LiFiService | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  routes: Route[];
  selectedRoute: Route | null;
  transferStatus: LiFiStatusResult | null;
  supportedChains: any[];
  availableTools: { bridges: any[], exchanges: any[] };
  
  // Methods
  getRoutes: (request: LiFiTransferRequest) => Promise<Route[]>;
  executeTransfer: (route: Route) => Promise<LiFiTransferResult>;
  getTransferStatus: (txHash: string, fromChain: number, toChain: number, bridge?: string) => Promise<LiFiStatusResult>;
  selectRoute: (route: Route) => void;
  clearRoutes: () => void;
  clearError: () => void;
  isCCTPAvailable: (fromChainId: number, toChainId: number) => Promise<boolean>;
  getCCTPFastFee: (fromChainId: number, toChainId: number, amount: string) => Promise<string>;
}

export const useLiFi = (): UseLiFiHook => {
  const { isTestnet } = useAppStore();
  
  const [lifiService, setLifiService] = useState<LiFiService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [transferStatus, setTransferStatus] = useState<LiFiStatusResult | null>(null);
  const [supportedChains, setSupportedChains] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<{ bridges: any[], exchanges: any[] }>({
    bridges: [],
    exchanges: [],
  });

  // Initialize LiFi service
  useEffect(() => {
    const service = new LiFiService(isTestnet);
    setLifiService(service);
    
    // Load supported chains and tools
    loadSupportedData(service);
  }, [isTestnet]);

  const loadSupportedData = async (service: LiFiService) => {
    try {
      const [chains, tools] = await Promise.all([
        service.getSupportedChains(),
        service.getAvailableTools(),
      ]);
      
      setSupportedChains(chains);
      setAvailableTools(tools);
    } catch (err) {
      console.error('Error loading supported data:', err);
    }
  };

  const getRoutes = useCallback(async (request: LiFiTransferRequest): Promise<Route[]> => {
    if (!lifiService) {
      throw new Error('LiFi service not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const routeResults = await lifiService.getRoute(request);
      setRoutes(routeResults);
      return routeResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get routes';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lifiService]);

  const executeTransfer = useCallback(async (route: Route): Promise<LiFiTransferResult> => {
    if (!lifiService) {
      throw new Error('LiFi service not initialized');
    }

    const signer = walletService.getSigner();
    if (!signer) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await lifiService.executeTransfer(route, signer);
      setTransferStatus({
        status: 'PENDING',
        substatus: 'Transaction submitted',
        sendingTxHash: result.txHash,
        fromChain: route.fromChainId,
        toChain: route.toChainId,
        bridge: route.steps[0]?.tool,
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute transfer';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lifiService]);

  const getTransferStatus = useCallback(async (
    txHash: string,
    fromChain: number,
    toChain: number,
    bridge?: string
  ): Promise<LiFiStatusResult> => {
    if (!lifiService) {
      throw new Error('LiFi service not initialized');
    }

    try {
      const status = await lifiService.getTransferStatus(txHash, fromChain, toChain, bridge);
      setTransferStatus(status);
      return status;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get transfer status';
      setError(errorMessage);
      throw err;
    }
  }, [lifiService]);

  const selectRoute = useCallback((route: Route) => {
    setSelectedRoute(route);
  }, []);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
    setSelectedRoute(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isCCTPAvailable = useCallback(async (fromChainId: number, toChainId: number): Promise<boolean> => {
    if (!lifiService) {
      return false;
    }

    try {
      return await lifiService.isCCTPAvailable(fromChainId, toChainId);
    } catch (err) {
      console.error('Error checking CCTP availability:', err);
      return false;
    }
  }, [lifiService]);

  const getCCTPFastFee = useCallback(async (fromChainId: number, toChainId: number, amount: string): Promise<string> => {
    if (!lifiService) {
      return '0';
    }

    try {
      return await lifiService.getCCTPFastFee(fromChainId, toChainId, amount);
    } catch (err) {
      console.error('Error getting CCTP fast fee:', err);
      return '0';
    }
  }, [lifiService]);

  return {
    lifiService,
    isLoading,
    error,
    routes,
    selectedRoute,
    transferStatus,
    supportedChains,
    availableTools,
    getRoutes,
    executeTransfer,
    getTransferStatus,
    selectRoute,
    clearRoutes,
    clearError,
    isCCTPAvailable,
    getCCTPFastFee,
  };
};

export default useLiFi;