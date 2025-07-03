import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CCTPService } from '@/lib/cctp';
import { USDCService } from '@/lib/usdc';
import { walletService } from '@/lib/wallet';
import { Recipient } from '@/types';

export const useCCTP = () => {
  const { 
    recipients, 
    updateRecipient, 
    addTransaction, 
    updateTransaction,
    selectedTransferMethod,
    setFeeEstimation,
    isTestnet
  } = useAppStore();
  
  const [isExecuting, setIsExecuting] = useState(false);

  const executeBulkTransfer = async () => {
    if (!walletService.getProvider() || !walletService.getSigner()) {
      throw new Error('Wallet not connected');
    }

    setIsExecuting(true);

    try {
      // Separate recipients by transfer type and chain
      const sameChainRecipients = recipients.filter(r => r.isSameChain && r.status === 'ready');
      const crossChainRecipients = recipients.filter(r => !r.isSameChain && r.status === 'ready');

      // Group cross-chain recipients by destination chain for batch processing
      const crossChainByDestination = crossChainRecipients.reduce((acc, recipient) => {
        const key = recipient.chainId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(recipient);
        return acc;
      }, {} as Record<number, Recipient[]>);

      // Handle same-chain transfers in a single batch
      if (sameChainRecipients.length > 0 && selectedTransferMethod === 'same-chain') {
        console.log(`Processing ${sameChainRecipients.length} same-chain recipients in batch...`);
        
        // Update all recipients to transferring status
        sameChainRecipients.forEach(recipient => {
          updateRecipient(recipient.id, { status: 'transferring' });
        });

        try {
          const usdcService = new USDCService(
            walletService.getProvider()!,
            walletService.getSigner()!,
            isTestnet
          );

          // Execute true batch transfer for all same-chain recipients
          const txHash = await usdcService.executeBatchTransfer(sameChainRecipients);
          
          // Update all recipients as completed with the same transaction hash
          sameChainRecipients.forEach(recipient => {
            updateRecipient(recipient.id, { 
              status: 'completed', 
              txHash: txHash 
            });

            addTransaction({
              id: `batch-transfer-${recipient.id}`,
              type: 'transfer',
              status: 'confirmed',
              txHash: txHash,
              chainId: recipient.chainId,
              amount: recipient.amount,
              recipient: recipient.address,
              timestamp: Date.now()
            });
          });

          console.log(`✅ Successfully completed batch transfer of ${sameChainRecipients.length} recipients in transaction: ${txHash}`);

        } catch (error) {
          console.error('Batch same-chain transfer failed:', error);
          
          // Handle user cancellation gracefully for all recipients
          if (error instanceof Error && error.message === 'Transaction cancelled by user') {
            sameChainRecipients.forEach(recipient => {
              updateRecipient(recipient.id, { 
                status: 'ready', 
                error: undefined 
              });
            });
          } else {
            sameChainRecipients.forEach(recipient => {
              updateRecipient(recipient.id, { 
                status: 'failed', 
                error: error instanceof Error ? error.message : 'Batch transfer failed'
              });
            });
          }
        }
      }

      // Handle cross-chain transfers grouped by destination chain
      if (Object.keys(crossChainByDestination).length > 0 && (selectedTransferMethod === 'fast' || selectedTransferMethod === 'standard')) {
        const cctpService = new CCTPService(
          walletService.getProvider()!,
          walletService.getSigner()!,
          isTestnet
        );

        for (const [destinationChainId, chainRecipients] of Object.entries(crossChainByDestination)) {
          console.log(`Processing ${chainRecipients.length} recipients for destination chain ${destinationChainId}...`);

          // Process recipients for this destination chain in parallel batches
          const batchSize = selectedTransferMethod === 'fast' ? 5 : 3; // Smaller batches for better management
          const batches = [];
          for (let i = 0; i < chainRecipients.length; i += batchSize) {
            batches.push(chainRecipients.slice(i, i + batchSize));
          }

          for (const batch of batches) {
            console.log(`Processing batch of ${batch.length} recipients...`);
            
            // Process batch in parallel
            const batchPromises = batch.map(async (recipient) => {
              try {
                // Update status to burning
                updateRecipient(recipient.id, { status: 'burning' });

                // Execute burn transaction
                const burnTxHash = await cctpService.burnUSDC(
                  recipient, 
                  parseInt(destinationChainId), 
                  selectedTransferMethod as 'fast' | 'standard'
                );
                
                updateRecipient(recipient.id, { 
                  status: 'attesting', 
                  txHash: burnTxHash 
                });

                addTransaction({
                  id: `burn-${recipient.id}`,
                  type: 'burn',
                  status: 'confirmed',
                  txHash: burnTxHash,
                  chainId: parseInt(destinationChainId),
                  amount: recipient.amount,
                  recipient: recipient.address,
                  timestamp: Date.now()
                });

                // Handle attestation and minting
                const network = await walletService.getProvider()!.getNetwork();
                const sourceChainId = Number(network.chainId);
                
                let messageData;
                let attempts = 0;
                const maxAttempts = selectedTransferMethod === 'fast' ? 12 : 60;
                
                while (attempts < maxAttempts) {
                  try {
                    messageData = await cctpService.getMessagesAndAttestation(burnTxHash, sourceChainId);
                    if (messageData.messages.length > 0 && messageData.messages[0].status === 'complete') {
                      break;
                    }
                  } catch (error) {
                    console.log(`Recipient ${recipient.id} - Attempt ${attempts + 1}: Waiting for attestation...`);
                  }
                  attempts++;
                  await new Promise(resolve => setTimeout(resolve, 
                    selectedTransferMethod === 'fast' ? 3000 : 30000
                  ));
                }

                if (!messageData || messageData.messages.length === 0 || messageData.messages[0].status !== 'complete') {
                  updateRecipient(recipient.id, { 
                    status: 'failed', 
                    error: 'Attestation timeout - please try manual completion later' 
                  });
                  return;
                }

                const message = messageData.messages[0];
                
                updateRecipient(recipient.id, { 
                  status: 'minting', 
                  attestationHash: message.attestation 
                });

                // Execute mint transaction
                const mintTxHash = await cctpService.mintUSDC(
                  message.message, 
                  message.attestation, 
                  parseInt(destinationChainId)
                );

                updateRecipient(recipient.id, { 
                  status: 'completed',
                  txHash: mintTxHash
                });

                addTransaction({
                  id: `mint-${recipient.id}`,
                  type: 'mint',
                  status: 'confirmed',
                  txHash: mintTxHash,
                  chainId: parseInt(destinationChainId),
                  amount: recipient.amount,
                  recipient: recipient.address,
                  timestamp: Date.now()
                });

                console.log(`✅ Successfully completed cross-chain transfer for recipient ${recipient.id}`);

              } catch (error) {
                console.error(`Failed to process recipient ${recipient.id}:`, error);
                
                if (error instanceof Error && error.message === 'Transaction cancelled by user') {
                  updateRecipient(recipient.id, { 
                    status: 'ready', 
                    error: undefined 
                  });
                } else {
                  updateRecipient(recipient.id, { 
                    status: 'failed', 
                    error: error instanceof Error ? error.message : 'Cross-chain transfer failed'
                  });
                }
              }
            });

            // Wait for current batch to complete before processing next batch
            await Promise.allSettled(batchPromises);
            
            // Small delay between batches to avoid overwhelming the network
            if (batches.indexOf(batch) < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
      }

      console.log('🎉 Bulk transfer process completed!');
      
    } catch (error) {
      console.error('Bulk transfer failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const estimateFees = async () => {
    if (!walletService.getProvider() || !walletService.getSigner()) {
      return;
    }

    try {
      if (selectedTransferMethod === 'same-chain') {
        // Use USDC service for same-chain fee estimation
        const usdcService = new USDCService(
          walletService.getProvider()!,
          walletService.getSigner()!,
          isTestnet
        );

        const fees = await usdcService.estimateFees(recipients);
        setFeeEstimation(fees);
      } else {
        // Use CCTP service for cross-chain fee estimation
        const cctpService = new CCTPService(
          walletService.getProvider()!,
          walletService.getSigner()!,
          isTestnet
        );

        const fees = await cctpService.estimateFees(recipients, selectedTransferMethod as 'fast' | 'standard');
        setFeeEstimation(fees);
      }
    } catch (error: any) {
      // Handle network change errors gracefully
      if (error.code === 'NETWORK_ERROR' || error.event === 'changed') {
        console.warn('Network change detected during fee estimation, will retry automatically');
        // Don't show error to user, just skip this estimation cycle
        return;
      }
      console.error('Failed to estimate fees:', error);
      
      // Set fallback fees for other errors
      setFeeEstimation({
        networkFees: selectedTransferMethod === 'same-chain' ? '~$5.00' : '~$15.00',
        cctpFees: selectedTransferMethod === 'fast' ? '~$5.00' : '~$0.00',
        total: selectedTransferMethod === 'same-chain' ? '~$5.00' : (selectedTransferMethod === 'fast' ? '~$20.00' : '~$15.00')
      });
    }
  };

  return {
    executeBulkTransfer,
    estimateFees,
    isExecuting
  };
};
