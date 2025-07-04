import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CCTPService } from '@/lib/cctp';
import { USDCService } from '@/lib/usdc';
import { walletService } from '@/lib/wallet';
import { useToast } from '@/hooks/use-toast';
import { Recipient, Transaction } from '@/types';

interface ExecutionProgress {
  stage: 'preparing' | 'burning' | 'attesting' | 'minting' | 'completed' | 'failed';
  message: string;
  completedRecipients: number;
  totalRecipients: number;
  currentRecipient?: Recipient;
  txHash?: string;
  error?: string;
}

export function usePaymentExecution() {
  const { 
    recipients, 
    wallet, 
    selectedTransferMethod, 
    isTestnet,
    updateRecipient,
    addTransaction
  } = useAppStore();
  
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);

  const executePayment = useCallback(async () => {
    if (!wallet.isConnected || recipients.length === 0) {
      toast({
        title: "Cannot Execute Payment",
        description: "Please connect your wallet and add recipients first.",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    setExecutionProgress({
      stage: 'preparing',
      message: 'Preparing payment execution...',
      completedRecipients: 0,
      totalRecipients: recipients.length
    });

    try {
      const provider = walletService.getProvider();
      const signer = walletService.getSigner();
      
      if (!provider || !signer) {
        throw new Error('Wallet not properly connected');
      }

      // Group recipients by transfer type
      const sameChainRecipients = recipients.filter(r => r.isSameChain);
      const crossChainRecipients = recipients.filter(r => !r.isSameChain);

      let completedCount = 0;

      // Execute same-chain transfers first
      if (sameChainRecipients.length > 0) {
        setExecutionProgress({
          stage: 'burning',
          message: 'Executing same-chain transfers...',
          completedRecipients: completedCount,
          totalRecipients: recipients.length
        });

        const usdcService = new USDCService(provider, signer, isTestnet);
        
        try {
          const txHash = await usdcService.executeBatchTransfer(sameChainRecipients);
          
          // Update recipient statuses
          for (const recipient of sameChainRecipients) {
            updateRecipient(recipient.id, {
              status: 'completed',
              txHash: txHash
            });
            
            addTransaction({
              id: `${txHash}-${recipient.id}`,
              type: 'transfer',
              status: 'confirmed',
              txHash: txHash,
              chainId: recipient.chainId,
              amount: recipient.amount,
              recipient: recipient.address,
              timestamp: Date.now()
            });
          }
          
          completedCount += sameChainRecipients.length;
          
          toast({
            title: "Same-Chain Transfers Completed",
            description: `Successfully transferred to ${sameChainRecipients.length} recipients.`,
          });
        } catch (error: any) {
          console.error('Same-chain transfer failed:', error);
          
          // Update failed recipients
          for (const recipient of sameChainRecipients) {
            updateRecipient(recipient.id, {
              status: 'failed',
              error: error.message
            });
          }
          
          toast({
            title: "Same-Chain Transfer Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      }

      // Execute cross-chain transfers
      if (crossChainRecipients.length > 0) {
        const cctpService = new CCTPService(provider, signer, isTestnet);
        
        for (const recipient of crossChainRecipients) {
          setExecutionProgress({
            stage: 'burning',
            message: `Burning USDC for ${recipient.address}...`,
            completedRecipients: completedCount,
            totalRecipients: recipients.length,
            currentRecipient: recipient
          });

          try {
            // Update recipient status to burning
            updateRecipient(recipient.id, { status: 'burning' });

            // Execute burn transaction
            const burnTxHash = await cctpService.burnUSDC(
              recipient, 
              recipient.chainId, 
              selectedTransferMethod as 'fast' | 'standard'
            );

            updateRecipient(recipient.id, {
              status: 'attesting',
              txHash: burnTxHash
            });

            addTransaction({
              id: `burn-${burnTxHash}`,
              type: 'burn',
              status: 'confirmed',
              txHash: burnTxHash,
              chainId: wallet.chainId!,
              amount: recipient.amount,
              recipient: recipient.address,
              timestamp: Date.now()
            });

            setExecutionProgress({
              stage: 'attesting',
              message: `Waiting for attestation (${selectedTransferMethod === 'fast' ? '~30s' : '~15min'})...`,
              completedRecipients: completedCount,
              totalRecipients: recipients.length,
              currentRecipient: recipient,
              txHash: burnTxHash
            });

            // Wait for attestation
            let attestationAttempts = 0;
            const maxAttempts = selectedTransferMethod === 'fast' ? 12 : 60; // 2 minutes for fast, 20 minutes for standard
            const waitTime = selectedTransferMethod === 'fast' ? 10000 : 20000; // 10s for fast, 20s for standard
            
            let messageResponse;
            
            while (attestationAttempts < maxAttempts) {
              try {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                messageResponse = await cctpService.getMessagesAndAttestation(burnTxHash, wallet.chainId!);
                
                if (messageResponse.messages && messageResponse.messages.length > 0) {
                  const message = messageResponse.messages[0];
                  if (message.status === 'complete' && message.attestation) {
                    break;
                  }
                }
                
                attestationAttempts++;
                setExecutionProgress({
                  stage: 'attesting',
                  message: `Waiting for attestation... (${attestationAttempts}/${maxAttempts})`,
                  completedRecipients: completedCount,
                  totalRecipients: recipients.length,
                  currentRecipient: recipient,
                  txHash: burnTxHash
                });
              } catch (error) {
                console.log('Attestation not ready, retrying...');
                attestationAttempts++;
              }
            }

            if (!messageResponse?.messages?.[0]?.attestation) {
              throw new Error('Attestation timeout. Please try again later.');
            }

            const message = messageResponse.messages[0];
            updateRecipient(recipient.id, {
              status: 'minting',
              attestationHash: message.attestation
            });

            setExecutionProgress({
              stage: 'minting',
              message: `Minting USDC on ${recipient.chainName}...`,
              completedRecipients: completedCount,
              totalRecipients: recipients.length,
              currentRecipient: recipient
            });

            // Execute mint transaction
            const mintTxHash = await cctpService.mintUSDC(
              message.message,
              message.attestation,
              recipient.chainId
            );

            updateRecipient(recipient.id, {
              status: 'completed',
              txHash: mintTxHash
            });

            addTransaction({
              id: `mint-${mintTxHash}`,
              type: 'mint',
              status: 'confirmed',
              txHash: mintTxHash,
              chainId: recipient.chainId,
              amount: recipient.amount,
              recipient: recipient.address,
              timestamp: Date.now()
            });

            completedCount++;
            
            toast({
              title: "Cross-Chain Transfer Completed",
              description: `Successfully transferred ${recipient.amount} USDC to ${recipient.chainName}.`,
            });

          } catch (error: any) {
            console.error('Cross-chain transfer failed:', error);
            
            updateRecipient(recipient.id, {
              status: 'failed',
              error: error.message
            });
            
            toast({
              title: "Transfer Failed",
              description: `Failed to transfer to ${recipient.address}: ${error.message}`,
              variant: "destructive",
            });
          }
        }
      }

      setExecutionProgress({
        stage: 'completed',
        message: 'All transfers completed!',
        completedRecipients: completedCount,
        totalRecipients: recipients.length
      });

      toast({
        title: "Payment Execution Completed",
        description: `Successfully completed ${completedCount} out of ${recipients.length} transfers.`,
      });

    } catch (error: any) {
      console.error('Payment execution failed:', error);
      
      setExecutionProgress({
        stage: 'failed',
        message: error.message,
        completedRecipients: 0,
        totalRecipients: recipients.length,
        error: error.message
      });

      toast({
        title: "Payment Execution Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
      
      // Clear progress after 5 seconds
      setTimeout(() => {
        setExecutionProgress(null);
      }, 5000);
    }
  }, [recipients, wallet, selectedTransferMethod, isTestnet, updateRecipient, addTransaction, toast]);

  return {
    executePayment,
    isExecuting,
    executionProgress
  };
}