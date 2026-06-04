import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from './classroom-storage';

export const USER_PROFILES_DIR = path.join(process.cwd(), 'data', 'user-profiles');

export interface UserProfileData {
  studentName: string;
  grade: number;
  teachingStyle: string;
  isInitialized: boolean;
}

const DEFAULT_PROFILE_PATH = path.join(USER_PROFILES_DIR, 'default.json');

export async function readUserProfile(): Promise<UserProfileData | null> {
  try {
    const content = await fs.readFile(DEFAULT_PROFILE_PATH, 'utf-8');
    return JSON.parse(content) as UserProfileData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeUserProfile(data: UserProfileData): Promise<void> {
  await fs.mkdir(USER_PROFILES_DIR, { recursive: true });
  await writeJsonFileAtomic(DEFAULT_PROFILE_PATH, data);
}
