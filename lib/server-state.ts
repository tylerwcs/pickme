import fs from 'fs-extra';
import path from 'path';
import { ChannelMessage } from '@/types';

// Store state in a temp file in the project directory
const DB_PATH = path.join(process.cwd(), 'draw-state.json');

const DEFAULT_STATE: ChannelMessage = {
  type: 'RESET',
  // Includes default display settings just in case
};

export async function getState(): Promise<ChannelMessage> {
  try {
    if (await fs.pathExists(DB_PATH)) {
      return await fs.readJson(DB_PATH);
    }
  } catch (error) {
    console.error('Error reading state:', error);
  }
  return DEFAULT_STATE;
}

export async function saveState(state: ChannelMessage) {
  try {
    await fs.writeJson(DB_PATH, state);
  } catch (error) {
    console.error('Error writing state:', error);
  }
}

