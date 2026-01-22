import fs from 'fs-extra';
import path from 'path';
import { ChannelMessage } from '@/types';

// Store state in a temp file
// On Vercel/Serverless, we must use /tmp. On local, we can use process.cwd() or just /tmp as well.
import os from 'os';

const TMP_DIR = os.tmpdir();
const DB_PATH = path.join(TMP_DIR, 'draw-state.json');

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

