import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CCTPService } from '@/lib/cctp';
import { USDCService } from '@/lib/usdc';
import { walletService } from '@/lib/wallet';

export function useFeeEstimation() {
  const { 
    recipients, 
    selectedTransferMethod, 
    setFeeEstimation, 
    wallet,
    isTestnet 
  } = useAppStore();

  const calculateFees = useCallback(async () => {
    // Reset fees if no recipients
    if (recipients.length === 0) {
      setFeeEstimation(null);
      return;
    }

    // Only calculate if wallet is connected
    if (!wallet.isConnected) {
      setFeeEstimation(null);
      return;
    }

    try {
      const provider = walletService.getProvider();
      const signer = walletService.getSigner();
      
      if (!provider || !signer) {
        console.warn('Provider or signer not available for fee estimation');
        return;
      }

      // Separate same-chain and cross-chain recipients
      const sameChainRecipients = recipients.filter(r => r.isSameChain);
      const crossChainRecipients = recipients.filter(r => !r.isSameChain);

      let totalNetworkFees = 0;
      let totalCctpFees = 0;

      // Calculate fees for same-chain transfers
      if (sameChainRecipients.length > 0) {
        const usdcService = new USDCService(provider, signer, isTestnet);
        const sameChainFees = await usdcService.estimateFees(sameChainRecipients);
        
        // Parse the fee strings (format: "~$X.XX")
        const networkFeeAmount = parseFloat(sameChainFees.networkFees.replace(/[~$,]/g, ''));
        totalNetworkFees += networkFeeAmount;
      }

      // Calculate fees for cross-chain transfers
      if (crossChainRecipients.length > 0) {
        const cctpService = new CCTPService(provider, signer, isTestnet);
        const crossChainFees = await cctpService.estimateFees(
          crossChainRecipients, 
          selectedTransferMethod as 'fast' | 'standard'
        );
        
        // Parse the fee strings (format: "~$X.XX")
        const networkFeeAmount = parseFloat(crossChainFees.networkFees.replace(/[~$,]/g, ''));
        const cctpFeeAmount = parseFloat(crossChainFees.cctpFees.replace(/[~$,]/g, ''));
        
        totalNetworkFees += networkFeeAmount;
        totalCctpFees += cctpFeeAmount;
      }

      const total = totalNetworkFees + totalCctpFees;

      setFeeEstimation({
        networkFees: `~$${totalNetworkFees.toFixed(2)}`,
        cctpFees: `~$${totalCctpFees.toFixed(2)}`,
        total: `~$${total.toFixed(2)}`
      });

    } catch (error) {
      console.error('Fee calculation failed:', error);
      
      // Set fallback fees based on transfer counts
      const fastFeePerTransfer = 5;
      const networkFeePerTransfer = 2;
      
      const fallbackNetworkFees = recipients.length * networkFeePerTransfer;
      const fallbackCctpFees = selectedTransferMethod === 'fast' 
        ? recipients.filter(r => !r.isSameChain).length * fastFeePerTransfer 
        : 0;
      
      setFeeEstimation({
        networkFees: `~$${fallbackNetworkFees.toFixed(2)}`,
        cctpFees: `~$${fallbackCctpFees.toFixed(2)}`,
        total: `~$${(fallbackNetworkFees + fallbackCctpFees).toFixed(2)}`
      });
    }
  }, [recipients, selectedTransferMethod, wallet.isConnected, wallet.chainId, isTestnet, setFeeEstimation]);

  // Recalculate fees whenever dependencies change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateFees();
    }, 500); // Debounce to avoid too many calculations

    return () => clearTimeout(timeoutId);
  }, [calculateFees]);

  return { calculateFees };
}