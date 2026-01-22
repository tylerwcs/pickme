export interface Participant {
  id: string; // Internal UUID for system tracking
  data: Record<string, string>; // Dynamic data fields (e.g. { "Name": "John", "ID": "123" })
  isPredetermined?: boolean;
}

export interface DrawSettings {
  winnerCount: number;
  gridColumns: number;
  duration: number;
  backgroundColor: string;
  removeWinners: boolean;
  isRolling: boolean;
  winners: Participant[];
  headers: string[]; // Order of columns to display
}

export type ChannelMessage = 
  | { type: 'START_ROLL'; count: number; gridColumns: number; duration: number; backgroundColor: string; removeWinners: boolean; pool?: Participant[]; headers?: string[] }
  | { type: 'STOP_ROLL'; winners: Participant[] }
  | { type: 'RESET' }
  | { type: 'UPDATE_COLUMNS'; gridColumns: number }
  | { type: 'UPDATE_BACKGROUND'; color: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DrawSettings> };
