import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { useWallet } from '@/hooks/useWallet';
import { 
  Wifi, 
  Database, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Server,
  Globe
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface SystemMetric {
  name: string;
  status: 'online' | 'offline' | 'warning';
  value: string;
  icon: React.ReactNode;
  description: string;
}

export default function SystemStatus() {
  const { wallet, autoRefresh, isTestnet, recipients } = useAppStore();
  const { isConnected } = useWallet();
  const [uptime, setUptime] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Track uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update last refresh time when auto-refresh is active
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastRefresh(new Date());
      }, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const metrics: SystemMetric[] = [
    {
      name: 'Wallet Connection',
      status: isConnected ? 'online' : 'offline',
      value: isConnected ? 'Connected' : 'Disconnected',
      icon: <Wifi className="w-4 h-4" />,
      description: isConnected ? `Chain: ${wallet.chainId || 'Unknown'}` : 'No wallet connected'
    },
    {
      name: 'Network Mode',
      status: 'online',
      value: isTestnet ? 'Testnet' : 'Mainnet',
      icon: <Globe className="w-4 h-4" />,
      description: isTestnet ? 'Testing environment' : 'Production environment'
    },
    {
      name: 'Auto Refresh',
      status: autoRefresh ? 'online' : 'offline',
      value: autoRefresh ? 'Active' : 'Inactive',
      icon: <Activity className="w-4 h-4" />,
      description: autoRefresh ? `Last: ${lastRefresh.toLocaleTimeString()}` : 'Manual refresh only'
    },
    {
      name: 'Active Transfers',
      status: recipients.some(r => ['burning', 'attesting', 'minting'].includes(r.status)) ? 'warning' : 'online',
      value: recipients.filter(r => ['burning', 'attesting', 'minting'].includes(r.status)).length.toString(),
      icon: <Server className="w-4 h-4" />,
      description: `${recipients.length} total recipients`
    }
  ];

  const getStatusIcon = (status: SystemMetric['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'offline':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: SystemMetric['status']) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'offline':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent>
        <div className="flex items-center justify-between mb-6">
          <CardTitle className="text-lg font-semibold text-white flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>System Status</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">
              Uptime: {formatUptime(uptime)}
            </span>
          </div>
        </div></CardContent>
        <div className="grid grid-cols-1 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.name}
              className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(metric.status)}`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {metric.icon}
                  {getStatusIcon(metric.status)}
                </div>
                <div>
                  <div className="font-medium text-slate-200">
                    {metric.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {metric.description}
                  </div>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`${getStatusColor(metric.status)} border font-medium`}
              >
                {metric.value}
              </Badge>
            </div>
          ))}
        </div>
        
        {/* Overall System Health */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">System Health</span>
            <div className="flex items-center space-x-2">
              {metrics.every(m => m.status === 'online') ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">All Systems Operational</span>
                </>
              ) : metrics.some(m => m.status === 'offline') ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">System Issues Detected</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-400">Minor Issues</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}