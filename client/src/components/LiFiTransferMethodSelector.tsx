import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Zap, Clock, Shield, DollarSign, Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { TRANSFER_METHODS } from '../lib/constants';

interface LiFiRoute {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  tool: string;
  estimatedTime: string;
  gasCost: string;
  fees: string;
  isCCTP: boolean;
  isFast: boolean;
}

interface LiFiTransferMethodSelectorProps {
  onMethodSelect: (method: string, route?: LiFiRoute) => void;
  fromChainId?: number;
  toChainId?: number;
  amount?: string;
}

export default function LiFiTransferMethodSelector({ 
  onMethodSelect, 
  fromChainId, 
  toChainId, 
  amount 
}: LiFiTransferMethodSelectorProps) {
  const { selectedTransferMethod } = useAppStore();
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<LiFiRoute[]>([]);
  const [cctpAvailable, setCctpAvailable] = useState(false);

  // Mock LiFi route data for demonstration
  useEffect(() => {
    if (fromChainId && toChainId && amount) {
      setIsLoadingRoutes(true);
      
      // Simulate API call to LiFi
      setTimeout(() => {
        const mockRoutes: LiFiRoute[] = [
          {
            id: 'cctp-fast',
            fromChainId,
            toChainId,
            fromToken: 'USDC',
            toToken: 'USDC',
            fromAmount: amount,
            toAmount: amount,
            tool: 'CCTP V2',
            estimatedTime: '8-20 seconds',
            gasCost: '$2.50',
            fees: '$0.10',
            isCCTP: true,
            isFast: true,
          },
          {
            id: 'cctp-standard',
            fromChainId,
            toChainId,
            fromToken: 'USDC',
            toToken: 'USDC',
            fromAmount: amount,
            toAmount: amount,
            tool: 'CCTP V1',
            estimatedTime: '13-19 minutes',
            gasCost: '$1.80',
            fees: '$0.00',
            isCCTP: true,
            isFast: false,
          },
          {
            id: 'stargate',
            fromChainId,
            toChainId,
            fromToken: 'USDC',
            toToken: 'USDC',
            fromAmount: amount,
            toAmount: (parseFloat(amount) * 0.998).toString(),
            tool: 'Stargate',
            estimatedTime: '5-10 minutes',
            gasCost: '$3.20',
            fees: '$0.20',
            isCCTP: false,
            isFast: false,
          }
        ];

        setAvailableRoutes(mockRoutes);
        setCctpAvailable(true);
        setIsLoadingRoutes(false);
      }, 1500);
    }
  }, [fromChainId, toChainId, amount]);

  const getMethodIcon = (method: string, isFast?: boolean) => {
    if (method.includes('CCTP') && isFast) return <Zap className="w-4 h-4" />;
    if (method.includes('CCTP')) return <Shield className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getMethodBadge = (route: LiFiRoute) => {
    if (route.isCCTP && route.isFast) {
      return <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Fast Transfer</Badge>;
    }
    if (route.isCCTP) {
      return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Standard</Badge>;
    }
    return <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Bridge</Badge>;
  };

  const renderTraditionalMethods = () => (
    <div className="grid gap-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-2">Traditional Methods</h3>
      {TRANSFER_METHODS.map((method) => (
        <Card 
          key={method.type}
          className={`glass-card cursor-pointer transition-all duration-300 ${
            selectedTransferMethod === method.type 
              ? 'ring-2 ring-emerald-500/50 bg-emerald-500/10' 
              : 'hover:bg-white/5'
          }`}
          onClick={() => onMethodSelect(method.type)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getMethodIcon(method.type)}
                <div>
                  <h3 className="font-semibold text-gray-100">{method.name}</h3>
                  <p className="text-sm text-gray-400">{method.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-300">{method.estimatedTime}</div>
                <div className="text-sm text-gray-400">{method.fee}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderLiFiRoutes = () => {
    if (isLoadingRoutes) {
      return (
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Finding optimal routes...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (availableRoutes.length === 0) {
      return null;
    }

    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">LiFi Optimized Routes</h3>
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
            Powered by LiFi
          </Badge>
        </div>
        
        {availableRoutes.map((route) => (
          <Card 
            key={route.id}
            className="glass-card cursor-pointer transition-all duration-300 hover:bg-white/5 group"
            onClick={() => onMethodSelect('lifi', route)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getMethodIcon(route.tool, route.isFast)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-100">{route.tool}</h3>
                      {getMethodBadge(route)}
                    </div>
                    <p className="text-sm text-gray-400">
                      Native USDC transfer • {route.estimatedTime}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <DollarSign className="w-3 h-3" />
                      {route.gasCost} gas
                    </div>
                    <div className="text-xs text-gray-400">
                      {route.fees} fees
                    </div>
                  </div>
                  
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>
              
              {route.isCCTP && (
                <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Circle CCTP {route.isFast ? 'V2' : 'V1'} - Native burn/mint process
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Routes Section */}
      {(fromChainId && toChainId && amount) && (
        <div>
          {renderLiFiRoutes()}
        </div>
      )}
      
      {/* Traditional Methods */}
      {renderTraditionalMethods()}
      
      {/* CCTP Information Banner */}
      {cctpAvailable && (
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-emerald-400 mb-1">Circle CCTP V2 Available</h4>
                <p className="text-sm text-gray-300 mb-2">
                  Experience lightning-fast USDC transfers that settle in seconds using Circle's 
                  Cross-Chain Transfer Protocol V2 with native burn/mint technology.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  <span>• Fastest: 8-20 seconds</span>
                  <span>• Native USDC</span>
                  <span>• Enhanced security</span>
                  <span>• Atomic execution</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}