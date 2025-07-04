import { useAppStore } from '@/store/useAppStore';
import { Users, DollarSign, TrendingUp, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { usePaymentExecution } from '@/hooks/usePaymentExecution';

export default function PaymentSummary() {
  const { recipients, wallet, selectedTransferMethod } = useAppStore();
  const { executePayment, isExecuting, executionProgress } = usePaymentExecution();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const totalAmount = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  
  const chainBreakdown = recipients.reduce((acc, recipient) => {
    const existing = acc.find(item => item.chainId === recipient.chainId);
    if (existing) {
      existing.amount += parseFloat(recipient.amount || '0');
    } else {
      acc.push({
        chainId: recipient.chainId,
        chainName: recipient.chainName,
        amount: parseFloat(recipient.amount || '0')
      });
    }
    return acc;
  }, [] as Array<{ chainId: number; chainName: string; amount: number }>);

  const getChainColor = (chainName: string) => {
    const colors = {
      'Ethereum': 'from-blue-400 to-blue-600',
      'Polygon': 'from-purple-400 to-purple-600',
      'Arbitrum': 'from-blue-500 to-cyan-500',
      'Base': 'from-blue-600 to-indigo-600',
      'OP Mainnet': 'from-red-400 to-red-600',
      'Avalanche': 'from-red-500 to-orange-500'
    };
    return colors[chainName as keyof typeof colors] || 'from-gray-400 to-gray-600';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gradient mb-2">Transfer Summary</h2>
        <p className="text-slate-400 text-sm">Review your transfer details</p>
      </div>

      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass-input rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Recipients</p>
                <p className="text-white font-bold text-base">{recipients.length}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-input rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total</p>
                <p className="text-white font-bold text-base">{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chain Breakdown */}
        {chainBreakdown.length > 0 && (
          <div className="glass-input rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h3 className="font-medium text-sm text-white">Chain Breakdown</h3>
            </div>
            <div className="space-y-3">
              {chainBreakdown.map((item) => (
                <div key={item.chainId} className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getChainColor(item.chainName)}`}></div>
                    <span className="text-slate-300 text-xs font-medium">{item.chainName}</span>
                  </div>
                  <span className="text-white font-medium text-xs">{item.amount.toFixed(2)} USDC</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Payment Execution Section */}
        {recipients.length > 0 && wallet.isConnected && (
          <div className="mt-6 space-y-4">
            {/* Execution Progress */}
            {executionProgress && (
              <div className="glass-input rounded-xl p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-white">
                    {executionProgress.stage === 'completed' ? 'Completed' : 'Processing...'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-2">{executionProgress.message}</p>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Progress: {executionProgress.completedRecipients}/{executionProgress.totalRecipients}</span>
                  {executionProgress.txHash && (
                    <span>TX: {executionProgress.txHash.slice(0, 10)}...</span>
                  )}
                </div>
              </div>
            )}

            {/* Payment Action Button */}
            <Button
              onClick={executePayment}
              disabled={isExecuting || recipients.length === 0}
              className="w-full glass-button bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all duration-300"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Execute {selectedTransferMethod === 'fast' ? 'Fast' : selectedTransferMethod === 'standard' ? 'Standard' : 'Same-Chain'} Transfer
                </>
              )}
            </Button>

            {/* Transfer Method Info */}
            <div className="glass-input rounded-xl p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Method:</span>
                <span className="text-white font-medium">
                  {selectedTransferMethod === 'fast' ? 'Fast Cross-Chain (~30s)' : 
                   selectedTransferMethod === 'standard' ? 'Standard Cross-Chain (~15min)' : 
                   'Same-Chain Transfer (~30s)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Connection Warning */}
        {recipients.length > 0 && !wallet.isConnected && (
          <div className="mt-6 glass-input rounded-xl p-4 border-orange-500/30">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-orange-400 font-medium text-sm">Wallet Not Connected</p>
                <p className="text-slate-400 text-xs">Please connect your wallet to execute transfers.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
