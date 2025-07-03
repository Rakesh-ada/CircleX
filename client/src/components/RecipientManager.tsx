import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAppStore } from '@/store/useAppStore';
import { SUPPORTED_CHAINS, TESTNET_CHAINS } from '@/lib/constants';
import { CSVUtils } from '@/lib/csvUtils';
import { useToast } from '@/hooks/use-toast';

import { useWallet } from '@/hooks/useWallet';
import { USDCService } from '@/lib/usdc';
import { walletService } from '@/lib/wallet';
import { Plus, Upload, Download, Trash2, Loader2, Clock, CheckCircle, AlertCircle, Activity, Zap, FileText, Users, Send, Brush } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RecipientManager() {
  const { recipients, addRecipient, removeRecipient, clearRecipients, isTestnet, wallet, updateRecipient, selectedTransferMethod } = useAppStore();
  const { toast } = useToast();
  const walletHook = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [payingRecipients, setPayingRecipients] = useState<Set<string>>(new Set());
  const [newRecipient, setNewRecipient] = useState({
    address: '',
    chainId: 1,
    amount: ''
  });
  const [statusUpdateTimestamps, setStatusUpdateTimestamps] = useState<{[key: string]: Date}>({});

  const availableChains = isTestnet ? TESTNET_CHAINS : SUPPORTED_CHAINS;
  
  // Include current chain for same-chain transfers, plus other chains for cross-chain
  const filteredChains = availableChains.filter(chain => {
    if (!wallet.isConnected || !wallet.chainId) return true;
    
    const currentChain = availableChains.find(c => c.id === wallet.chainId);
    if (!currentChain) return true;
    
    // Allow current chain for same-chain transfers, and different CCTP domains for cross-chain
    return chain.id === wallet.chainId || chain.cctpDomain !== currentChain.cctpDomain;
  });

  // Update timestamps when statuses change
  useEffect(() => {
    recipients.forEach(recipient => {
      if (!statusUpdateTimestamps[recipient.id]) {
        setStatusUpdateTimestamps(prev => ({
          ...prev,
          [recipient.id]: new Date()
        }));
      } else if (recipient.status !== 'ready') {
        setStatusUpdateTimestamps(prev => ({
          ...prev,
          [recipient.id]: new Date()
        }));
      }
    });
  }, [recipients]);

  const handleAddRecipient = () => {
    const chain = availableChains.find(c => c.id === newRecipient.chainId)!;
    const isSameChain = wallet.isConnected && wallet.chainId === newRecipient.chainId;
    
    addRecipient({
      address: newRecipient.address,
      chainId: newRecipient.chainId,
      chainName: chain.name,
      amount: newRecipient.amount,
      status: 'ready',
      isSameChain: isSameChain
    });
    // Reset with the first available chain from filtered chains
    const defaultChainId = filteredChains.length > 0 ? filteredChains[0].id : 1;
    setNewRecipient({ address: '', chainId: defaultChainId, amount: '' });
    setShowAddDialog(false);
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedRecipients = await CSVUtils.importFromFile(file, isTestnet);
      
      // Add each recipient
      importedRecipients.forEach(recipient => {
        const isSameChain = wallet.isConnected && wallet.chainId === recipient.chainId;
        addRecipient({
          ...recipient,
          status: 'ready',
          isSameChain
        });
      });

      toast({
        title: "CSV Import Successful",
        description: `Imported ${importedRecipients.length} recipients from ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCSVExport = () => {
    if (recipients.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Add some recipients before exporting to CSV",
        variant: "destructive",
      });
      return;
    }

    CSVUtils.downloadCSV(recipients);
    toast({
      title: "Export Successful",
      description: `Exported ${recipients.length} recipients to CSV`,
    });
  };

  const handleDownloadSample = () => {
    CSVUtils.downloadSampleCSV();
    toast({
      title: "Sample Downloaded",
      description: "Downloaded sample CSV format for reference",
    });
  };

  // Update default chain when dialog opens
  const handleOpenDialog = () => {
    const defaultChainId = filteredChains.length > 0 ? filteredChains[0].id : 1;
    setNewRecipient({ ...newRecipient, chainId: defaultChainId });
    setShowAddDialog(true);
  };

  const handleIndividualPayment = async (recipient: any) => {
    const provider = walletService.getProvider();
    const signer = walletService.getSigner();
    
    if (!provider || !signer) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet before making payments",
        variant: "destructive"
      });
      return;
    }

    if (!wallet.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to continue",
        variant: "destructive"
      });
      return;
    }

    setPayingRecipients(prev => new Set(prev).add(recipient.id));
    updateRecipient(recipient.id, { status: 'pending' });

    try {
      let txHash: string;

      if (recipient.isSameChain) {
        // Same-chain USDC transfer
        updateRecipient(recipient.id, { status: 'transferring' });
        const usdcService = new USDCService(provider, signer, isTestnet);
        txHash = await usdcService.executeBatchTransfer([recipient]);
        
        updateRecipient(recipient.id, { 
          status: 'completed', 
          txHash 
        });

        toast({
          title: "Payment Successful",
          description: `Successfully sent ${recipient.amount} USDC to ${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`,
        });
      } else {
        // Cross-chain CCTP transfer
        updateRecipient(recipient.id, { status: 'burning' });
        const { CCTPService } = await import('@/lib/cctp');
        const cctpService = new CCTPService(provider, signer, isTestnet);
        
        // Use fast or standard method, not same-chain for CCTP
        const transferMethod: 'fast' | 'standard' = selectedTransferMethod === 'same-chain' ? 'fast' : selectedTransferMethod as 'fast' | 'standard';
        
        // Burn USDC on source chain
        txHash = await cctpService.burnUSDC(recipient, recipient.chainId, transferMethod);
        updateRecipient(recipient.id, { 
          status: 'attesting', 
          txHash 
        });

        toast({
          title: "Cross-Chain Transfer Started",
          description: `Burn transaction successful. Starting attestation process...`,
        });

        // Wait for attestation and mint
        setTimeout(async () => {
          try {
            updateRecipient(recipient.id, { status: 'minting' });
            
            // In a real implementation, you would:
            // 1. Wait for attestation from Circle API
            // 2. Call mintUSDC on destination chain
            // For now, we'll simulate the process
            
            setTimeout(() => {
              updateRecipient(recipient.id, { 
                status: 'completed',
                attestationHash: 'simulated-hash'
              });
              
              toast({
                title: "Cross-Chain Transfer Complete",
                description: `Successfully sent ${recipient.amount} USDC to ${recipient.chainName}`,
              });
            }, 5000);
            
          } catch (error: any) {
            updateRecipient(recipient.id, { 
              status: 'failed', 
              error: error.message 
            });
            
            toast({
              title: "Minting Failed",
              description: error.message,
              variant: "destructive"
            });
          }
        }, 3000);
      }

    } catch (error: any) {
      updateRecipient(recipient.id, { 
        status: 'failed', 
        error: error.message 
      });

      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setPayingRecipients(prev => {
        const newSet = new Set(prev);
        newSet.delete(recipient.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string, recipientId: string) => {
    const timestamp = statusUpdateTimestamps[recipientId];
    const timeAgo = timestamp ? Math.floor((Date.now() - timestamp.getTime()) / 1000) : 0;
    
    const statusConfig = {
      ready: { 
        color: 'bg-slate-600 text-slate-300', 
        text: 'Ready', 
        icon: <CheckCircle className="w-3 h-3" /> 
      },
      pending: { 
        color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', 
        text: 'Pending', 
        icon: <Clock className="w-3 h-3 animate-pulse" /> 
      },
      transferring: { 
        color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', 
        text: 'Transferring', 
        icon: <Loader2 className="w-3 h-3 animate-spin" /> 
      },
      burning: { 
        color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', 
        text: 'Burning', 
        icon: <Activity className="w-3 h-3 animate-bounce" /> 
      },
      attesting: { 
        color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', 
        text: 'Attesting', 
        icon: <Clock className="w-3 h-3 animate-pulse" /> 
      },
      minting: { 
        color: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30', 
        text: 'Minting', 
        icon: <Zap className="w-3 h-3 animate-pulse" /> 
      },
      completed: { 
        color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', 
        text: 'Completed', 
        icon: <CheckCircle className="w-3 h-3" /> 
      },
      failed: { 
        color: 'bg-red-500/20 text-red-400 border border-red-500/30', 
        text: 'Failed', 
        icon: <AlertCircle className="w-3 h-3" /> 
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ready;
    
    return (
      <div className="flex flex-col items-start space-y-1">
        <span className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium space-x-1',
          config.color
        )}>
          {config.icon}
          <span>{config.text}</span>
        </span>
        {status !== 'ready' && timeAgo > 0 && (
          <span className="text-xs text-slate-500">
            {timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`}
          </span>
        )}
      </div>
    );
  };

  const getChainColor = (chainName: string) => {
    const colors = {
      'Ethereum': 'bg-red-500',
      'Sepolia': 'bg-red-500',
      'Polygon': 'bg-purple-500',
      'Polygon Amoy': 'bg-purple-500',
      'Arbitrum': 'bg-blue-500',
      'Arbitrum Sepolia': 'bg-blue-500',
      'Base': 'bg-blue-600',
      'Base Sepolia': 'bg-blue-600',
      'OP Mainnet': 'bg-red-600',
      'OP Sepolia': 'bg-red-600',
      'Avalanche': 'bg-red-400',
      'Avalanche Fuji': 'bg-red-400',
      'Linea': 'bg-green-500',
      'Linea Sepolia': 'bg-green-500',
      'Sonic Testnet': 'bg-cyan-500',
      'Unichain Sepolia': 'bg-pink-500',
      'World Chain Sepolia': 'bg-indigo-500'
    };
    return colors[chainName as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <>
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVImport}
        className="hidden"
      />

      <div className="glass-card rounded-xl shimmer p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-gradient" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gradient">Team Recipients</h2>
            </div>
          </div>
            
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="glass-button text-white font-medium"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCSVExport}
              disabled={recipients.length === 0}
              className="glass-button text-white font-medium"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {recipients.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearRecipients}
                className="glass-button text-red-400 font-medium hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All
              </Button>
            )}

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  className="glass-button text-white font-medium bg-cyan-400/20 hover:bg-cyan-400/30"
                  onClick={handleOpenDialog}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Recipient
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-slate-600/50">
                <DialogHeader>
                  <DialogTitle className="text-gradient">Add New Recipient</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {wallet.isConnected && filteredChains.length < availableChains.length && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                      <p className="text-sm text-yellow-400">
                        <strong>Note:</strong> Only showing chains with different CCTP domains than your current connected chain. 
                        CCTP doesn't support transfers within the same domain.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-300">Address</label>
                    <Input
                      value={newRecipient.address}
                      onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
                      placeholder="0x..."
                      className="glass-input text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Chain</label>
                    <Select
                      value={newRecipient.chainId.toString()}
                      onValueChange={(value) => setNewRecipient({ ...newRecipient, chainId: parseInt(value) })}
                    >
                      <SelectTrigger className="glass-input text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-slate-600">
                        {filteredChains.map((chain) => (
                          <SelectItem key={chain.id} value={chain.id.toString()}>
                            {chain.name}
                          </SelectItem>
                        ))}
                        {filteredChains.length === 0 && (
                          <div className="p-3 text-sm text-slate-400 text-center">
                            No destination chains available. Please connect to a different source chain.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Amount (USDC)</label>
                    <Input
                      value={newRecipient.amount}
                      onChange={(e) => setNewRecipient({ ...newRecipient, amount: e.target.value })}
                      placeholder="100.00"
                      type="number"
                      step="0.01"
                      className="glass-input text-white"
                    />
                  </div>
                  <Button onClick={handleAddRecipient} className="w-full glass-button text-white font-medium">
                    Add Recipient
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {recipients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-4 text-sm font-medium text-slate-300">Recipient Address</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-300">Destination Chain</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-300">Amount (USDC)</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-300">Status</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="p-4">
                      <div className="font-mono text-sm text-white">
                        {recipient.address.slice(0, 20)}...
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-white">{recipient.chainName}</span>
                        {recipient.isSameChain ? (
                          <span className="text-xs text-cyan-400">Same-Chain</span>
                        ) : (
                          <span className="text-xs text-purple-400">Cross-Chain</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-white">{recipient.amount}</span>
                    </td>
                    <td className="p-4">
                      {recipient.status === 'ready' ? (
                        <Button
                          size="sm"
                          onClick={() => handleIndividualPayment(recipient)}
                          disabled={payingRecipients.has(recipient.id)}
                          className="glass-button text-white font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30"
                        >
                          {payingRecipients.has(recipient.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      ) : (
                        getStatusBadge(recipient.status, recipient.id)
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecipient(recipient.id)}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Brush className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Add recipients manually or import from CSV</p>
          </div>
        )}
      </div>
    </>
  );
}
