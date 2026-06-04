/**
 * User Profile Store
 * Persists avatar, nickname & bio to localStorage
 * Also syncs learning style preferences with backend
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Predefined avatar options */
export const AVATAR_OPTIONS = [
  '/avatars/user.png',
  '/avatars/teacher-2.png',
  '/avatars/assist-2.png',
  '/avatars/clown-2.png',
  '/avatars/curious-2.png',
  '/avatars/note-taker-2.png',
  '/avatars/thinker-2.png',
] as const;

export interface UserProfileState {
  /** Local avatar path or data-URL (for custom uploads) */
  avatar: string;
  nickname: string;
  bio: string;
  studentName: string;
  grade: number;
  teachingStyle: string;
  isInitialized: boolean;
  hasLoadedFromServer: boolean;
  setAvatar: (avatar: string) => void;
  setNickname: (nickname: string) => void;
  setBio: (bio: string) => void;
  setStudentName: (name: string) => void;
  setGrade: (grade: number) => void;
  setTeachingStyle: (style: string) => void;
  setIsInitialized: (val: boolean) => void;
  fetchProfile: () => Promise<void>;
  saveProfile: (data: { studentName: string; grade: number; teachingStyle: string }) => Promise<void>;
}

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    (set, get) => ({
      avatar: AVATAR_OPTIONS[0],
      nickname: '',
      bio: '',
      studentName: '',
      grade: 4,
      teachingStyle: '',
      isInitialized: false,
      hasLoadedFromServer: false,
      setAvatar: (avatar) => set({ avatar }),
      setNickname: (nickname) => set({ nickname }),
      setBio: (bio) => set({ bio }),
      setStudentName: (studentName) => set({ studentName }),
      setGrade: (grade) => set({ grade }),
      setTeachingStyle: (teachingStyle) => set({ teachingStyle }),
      setIsInitialized: (isInitialized) => set({ isInitialized }),
      fetchProfile: async () => {
        try {
          const res = await fetch('/api/user-profile');
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              set({
                studentName: json.data.studentName || '',
                grade: json.data.grade || 4,
                teachingStyle: json.data.teachingStyle || '',
                isInitialized: json.data.isInitialized || false,
                hasLoadedFromServer: true,
              });
              return;
            }
          }
        } catch (e) {
          console.error('Failed to fetch user profile', e);
        }
        set({ hasLoadedFromServer: true });
      },
      saveProfile: async (data) => {
        try {
          const res = await fetch('/api/user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            set({ ...data, isInitialized: true });
          }
        } catch (e) {
          console.error('Failed to save user profile', e);
        }
      },
    }),
    {
      name: 'user-profile-storage',
    },
  ),
);
