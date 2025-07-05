import { useAppStore } from '@/store/useAppStore';
import { useFeeEstimation } from '@/hooks/useFeeEstimation';
import { DollarSign } from 'lucide-react';

export default function FeeEstimation() {
  const { feeEstimation, recipients } = useAppStore();
  
  // This hook will automatically calculate fees when recipients or settings change
  useFeeEstimation();

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gradient mb-2 flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Fee Estimation</span>
        </h2>
        <p className="text-slate-400 text-sm">Estimated costs for your transfers</p>
      </div>
      {!feeEstimation || recipients.length === 0 ? (
        <div className="text-center text-slate-400 py-8 pt-[3px] pb-[3px]">
          <p className="text-sm">Add recipients to see fee estimation</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-300">Network Fees</span>
            <span className="font-medium text-white">{feeEstimation.networkFees}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-300">CCTP Transfer Fees</span>
            <span className="font-medium text-white">{feeEstimation.cctpFees}</span>
          </div>
          <div className="border-t border-slate-700/50 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-white">Total Estimated</span>
              <span className="font-semibold text-lg text-gradient">{feeEstimation.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
