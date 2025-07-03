import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/store/useAppStore';
import { Settings } from 'lucide-react';

export default function SettingsPanel() {
  const { isTestnet, setTestnet, autoRefresh, setAutoRefresh } = useAppStore();

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gradient mb-2 flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </h2>
        <p className="text-slate-400 text-sm">Configure your preferences</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-slate-300 font-medium">Testnet Mode</span>
            <p className="text-slate-500 text-xs mt-1">Use test networks for development</p>
          </div>
          <Switch
            checked={isTestnet}
            onCheckedChange={setTestnet}
          />
        </div>
        
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-slate-300 font-medium">Auto-refresh</span>
            <p className="text-slate-500 text-xs mt-1">Automatically update balances and status</p>
          </div>
          <Switch
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
        </div>
      </div>
    </div>
  );
}
