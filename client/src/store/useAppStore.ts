import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Recipient, WalletState, TransferMethod, Transaction, FeeEstimation } from '@/types';

interface AppState {
  // Wallet state
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;
  
  // Transfer settings
  selectedTransferMethod: TransferMethod['type'];
  setTransferMethod: (method: TransferMethod['type']) => void;
  
  // Recipients
  recipients: Recipient[];
  addRecipient: (recipient: Omit<Recipient, 'id'>) => void;
  updateRecipient: (id: string, updates: Partial<Recipient>) => void;
  removeRecipient: (id: string) => void;
  clearRecipients: () => void;
  
  // Transactions
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  
  // Settings
  isTestnet: boolean;
  setTestnet: (testnet: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (refresh: boolean) => void;
  
  // Fee estimation
  feeEstimation: FeeEstimation | null;
  setFeeEstimation: (fees: FeeEstimation | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      wallet: {
        isConnected: false,
        address: null,
        chainId: null,
        balance: '0'
      },
      setWallet: (wallet) => set((state) => ({ 
        wallet: { ...state.wallet, ...wallet } 
      })),
      
      selectedTransferMethod: 'fast',
      setTransferMethod: (method) => set({ selectedTransferMethod: method }),
      
      recipients: [],
      addRecipient: (recipient) => set((state) => ({
        recipients: [...state.recipients, { ...recipient, id: Date.now().toString() }]
      })),
      updateRecipient: (id, updates) => set((state) => ({
        recipients: state.recipients.map(r => r.id === id ? { ...r, ...updates } : r)
      })),
      removeRecipient: (id) => set((state) => ({
        recipients: state.recipients.filter(r => r.id !== id)
      })),
      clearRecipients: () => set({ recipients: [] }),
      
      transactions: [],
      addTransaction: (transaction) => set((state) => ({
        transactions: [...state.transactions, transaction]
      })),
      updateTransaction: (id, updates) => set((state) => ({
        transactions: state.transactions.map(t => t.id === id ? { ...t, ...updates } : t)
      })),
      
      isTestnet: false,
      setTestnet: (testnet) => set({ isTestnet: testnet }),
      
      autoRefresh: true,
      setAutoRefresh: (refresh) => set({ autoRefresh: refresh }),
      
      feeEstimation: null,
      setFeeEstimation: (fees) => set({ feeEstimation: fees })
    }),
    {
      name: 'cctp-bulk-payment-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recipients: state.recipients,
        selectedTransferMethod: state.selectedTransferMethod,
        isTestnet: state.isTestnet,
        autoRefresh: state.autoRefresh
      })
    }
  )
);
