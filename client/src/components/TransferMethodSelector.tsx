import { useAppStore } from '@/store/useAppStore';
import { TRANSFER_METHODS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Zap, Clock, Shield, ArrowRightLeft } from 'lucide-react';

export default function TransferMethodSelector() {
  const { selectedTransferMethod, setTransferMethod } = useAppStore();

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'same-chain':
        return <ArrowRightLeft className="w-5 h-5" />;
      case 'fast':
        return <Zap className="w-5 h-5" />;
      case 'standard':
        return <Shield className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {TRANSFER_METHODS.map((method) => (
        <div
          key={method.type}
          className={cn(
            "relative group cursor-pointer transition-all duration-300 rounded-xl p-6",
            selectedTransferMethod === method.type
              ? "glass-card glow-border scale-105"
              : "glass-input hover:glass-card hover:scale-102"
          )}
          onClick={() => setTransferMethod(method.type)}
        >

          
          {/* Icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
            selectedTransferMethod === method.type
              ? "bg-blue-500/20 text-blue-400"
              : "bg-slate-700/50 text-slate-400 group-hover:bg-blue-500/10 group-hover:text-blue-400"
          )}>
            {getMethodIcon(method.type)}
          </div>

          {/* Method info */}
          <div className="mb-3">
            <h3 className={cn(
              "font-semibold mb-1 transition-colors",
              selectedTransferMethod === method.type
                ? "text-white"
                : "text-slate-300 group-hover:text-white"
            )}>
              {method.name}
            </h3>

          </div>

          {/* Time and fee */}
          <div className="flex items-center justify-between text-xs">
            <span className={cn(
              "px-3 py-1 rounded-full transition-colors",
              selectedTransferMethod === method.type
                ? "bg-blue-500/20 text-blue-400"
                : "bg-slate-700/50 text-slate-400 group-hover:bg-blue-500/10 group-hover:text-blue-400"
            )}>
              {method.estimatedTime}
            </span>
            <span className="text-slate-500">
              {method.fee}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
