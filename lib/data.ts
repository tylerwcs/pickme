import { Participant } from '@/types';

// Mock data generator
export const MOCK_HEADERS = ['Staff ID', 'Name', 'Company'];

export const MOCK_PARTICIPANTS: Participant[] = Array.from({ length: 200 }, (_, i) => ({
  id: `mock-${i + 1}`, // Internal ID
  data: {
    'Staff ID': `S${(i + 1).toString().padStart(3, '0')}`,
    'Name': `Participant ${i + 1}`,
    'Company': i % 2 === 0 ? 'JET COMMERCE' : 'OTHER CORP',
  }
}));
