import { Recipient } from '@/types';
import { SUPPORTED_CHAINS, TESTNET_CHAINS } from './constants';

interface CSVRecipient {
  address: string;
  chainName: string;
  amount: string;
}

export class CSVUtils {
  static exportToCSV(recipients: Recipient[]): string {
    const headers = ['Address', 'Chain', 'Amount (USDC)', 'Status', 'Transaction Link'];
    const csvContent = [
      headers.join(','),
      ...recipients.map(recipient => {
        const transactionLink = CSVUtils.getTransactionLink(recipient);
        return [
          recipient.address,
          recipient.chainName,
          recipient.amount,
          recipient.status,
          transactionLink
        ].join(',');
      })
    ].join('\n');
    
    return csvContent;
  }

  static getTransactionLink(recipient: Recipient): string {
    if (!recipient.txHash) {
      return '';
    }

    // Get the appropriate chain info
    const allChains = [...SUPPORTED_CHAINS, ...TESTNET_CHAINS];
    const chain = allChains.find(c => c.id === recipient.chainId);
    
    if (!chain) {
      return recipient.txHash;
    }

    return `${chain.blockExplorer}/tx/${recipient.txHash}`;
  }

  static downloadCSV(recipients: Recipient[], filename: string = 'team-pay-recipients.csv'): void {
    const csvContent = this.exportToCSV(recipients);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  static parseCSV(csvText: string, isTestnet: boolean = false): Promise<Omit<Recipient, 'id' | 'status'>[]> {
    return new Promise((resolve, reject) => {
      try {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        // Find column indices
        const addressIndex = headers.findIndex(h => h.includes('address'));
        const chainIndex = headers.findIndex(h => h.includes('chain'));
        const amountIndex = headers.findIndex(h => h.includes('amount'));
        
        if (addressIndex === -1 || chainIndex === -1 || amountIndex === -1) {
          throw new Error('CSV must contain columns: Address, Chain, Amount');
        }

        const availableChains = isTestnet ? TESTNET_CHAINS : SUPPORTED_CHAINS;
        const recipients: Omit<Recipient, 'id' | 'status'>[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const columns = line.split(',').map(col => col.trim());
          
          if (columns.length < Math.max(addressIndex, chainIndex, amountIndex) + 1) {
            errors.push(`Line ${i + 1}: Insufficient columns`);
            continue;
          }

          const address = columns[addressIndex];
          const chainName = columns[chainIndex];
          const amount = columns[amountIndex];

          // Validate address
          if (!address || !address.startsWith('0x') || address.length !== 42) {
            errors.push(`Line ${i + 1}: Invalid address format`);
            continue;
          }

          // Find chain
          const chain = availableChains.find(c => 
            c.name.toLowerCase() === chainName.toLowerCase() ||
            c.symbol.toLowerCase() === chainName.toLowerCase()
          );

          if (!chain) {
            errors.push(`Line ${i + 1}: Unknown chain "${chainName}"`);
            continue;
          }

          // Validate amount
          const parsedAmount = parseFloat(amount);
          if (isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.push(`Line ${i + 1}: Invalid amount "${amount}"`);
            continue;
          }

          recipients.push({
            address,
            chainId: chain.id,
            chainName: chain.name,
            amount: amount,
            isSameChain: false // Will be determined when added to store
          });
        }

        if (errors.length > 0) {
          throw new Error(`CSV parsing errors:\n${errors.join('\n')}`);
        }

        resolve(recipients);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async importFromFile(file: File, isTestnet: boolean = false): Promise<Omit<Recipient, 'id' | 'status'>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          const recipients = await this.parseCSV(csvText, isTestnet);
          resolve(recipients);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  static generateSampleCSV(): string {
    const sampleData = [
      ['Address', 'Chain', 'Amount (USDC)'],
      ['0x1234567890123456789012345678901234567890', 'Ethereum', '100.00'],
      ['0x0987654321098765432109876543210987654321', 'Polygon', '250.50'],
      ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'Arbitrum', '75.25']
    ];
    
    return sampleData.map(row => row.join(',')).join('\n');
  }

  static downloadSampleCSV(): void {
    const csvContent = this.generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'team-pay-sample.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}