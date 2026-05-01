import AsyncStorage from '@react-native-async-storage/async-storage';

export type TimerFeedback = 'vibration' | 'sound' | 'both' | 'none';

let _feedback: TimerFeedback = 'vibration';

export function getTimerFeedbackSync(): TimerFeedback {
  return _feedback;
}

export async function loadTimerFeedback(): Promise<void> {
  const val = await AsyncStorage.getItem('timer_feedback');
  _feedback = (val as TimerFeedback) ?? 'vibration';
}

export async function setTimerFeedback(value: TimerFeedback): Promise<void> {
  _feedback = value;
  await AsyncStorage.setItem('timer_feedback', value);
}
