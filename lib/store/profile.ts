import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StudentProfile {
  id: string;
  parentId: string;
  name: string;
  grade: number;
  teachingStyle: string;
  ttsVoice?: string | null;
  avatarUrl: string | null;
}

interface ProfileState {
  activeProfile: StudentProfile | null;
  setActiveProfile: (profile: StudentProfile | null) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      activeProfile: null,
      setActiveProfile: (profile) => set({ activeProfile: profile }),
    }),
    {
      name: 'mistake-active-profile',
    }
  )
);
