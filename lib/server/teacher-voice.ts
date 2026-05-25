import fs from 'fs';
import path from 'path';

let cachedTeacherAudio: string | null = null;
let cachedTeacherText: string | null = null;

export function getTeacherVoice() {
  if (cachedTeacherAudio !== null) return { audio: cachedTeacherAudio, text: cachedTeacherText, mimeType: 'audio/wav', fileName: 'teacher.wav' };
  try {
    const audioPathWav = path.join(process.cwd(), 'assets', 'voices', 'teacher.wav');
    const audioPathWmv = path.join(process.cwd(), 'assets', 'voices', 'teacher.wmv');
    const audioPathMp3 = path.join(process.cwd(), 'assets', 'voices', 'teacher.mp3');
    
    let audioPath = '';
    let mimeType = 'audio/wav';
    let ext = '.wav';
    
    if (fs.existsSync(audioPathWav)) {
      audioPath = audioPathWav;
    } else if (fs.existsSync(audioPathWmv)) {
      audioPath = audioPathWmv;
      mimeType = 'audio/x-ms-wmv';
      ext = '.wmv';
    } else if (fs.existsSync(audioPathMp3)) {
      audioPath = audioPathMp3;
      mimeType = 'audio/mpeg';
      ext = '.mp3';
    }

    const textPath = path.join(process.cwd(), 'assets', 'voices', 'teacher.txt');
    if (audioPath && fs.existsSync(textPath)) {
      cachedTeacherAudio = fs.readFileSync(audioPath).toString('base64');
      cachedTeacherText = fs.readFileSync(textPath, 'utf-8').trim();
      return { 
        audio: cachedTeacherAudio, 
        text: cachedTeacherText, 
        mimeType, 
        fileName: `teacher${ext}` 
      };
    } else {
      cachedTeacherAudio = '';
      cachedTeacherText = '';
    }
  } catch (e) {
    cachedTeacherAudio = '';
    cachedTeacherText = '';
  }
  return { audio: cachedTeacherAudio, text: cachedTeacherText, mimeType: 'audio/wav', fileName: 'teacher.wav' };
}
