import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, BackHandler, Vibration,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { COLORS } from '../../theme/colors';
import { getTimerFeedbackSync } from '../../utils/settings';
import { getExercisesForCard, getLastWeightForExercise } from '../../database/cardExerciseRepository';
import { getCard } from '../../database/cardRepository';
import { createSession, finalizeSession, deleteSession, saveSet } from '../../database/sessionRepository';
import type { CardExerciseWithName, WorkoutCard } from '../../types';
import type { WorkoutStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<WorkoutStackParamList, 'AllenamentoAttivo'>;
type RouteProps = RouteProp<WorkoutStackParamList, 'AllenamentoAttivo'>;

interface ExerciseProgress {
  currentSet: number;
  weight:     string;
  completed:  boolean;
}

interface BufferedSetEntry {
  exerciseName:    string;
  cardExerciseId:  number;
  exerciseId:      number;
  setNumber:       number;
  reps:            number;
  weight:          number | null;
  exerciseType:    'reps' | 'time';
  skipped?:        boolean;
}

type TimedPhase = 'idle' | 'pre' | 'running' | 'done';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function scheduleRestNotification(seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recupero terminato!',
      body:  'Pronto per la prossima serie.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

interface GroupInfo {
  groupId:      number;
  type:         'superset' | 'circuit' | 'simple';
  rounds:       number;
  restTime:     number;   // group rest (after round end)
  exRestTime:   number;   // per-exercise rest (used in circuit between exercises)
  firstIdx:     number;
  lastIdx:      number;
  isLastInGroup: boolean;
}

function getGroupInfo(exercises: CardExerciseWithName[], idx: number): GroupInfo | null {
  const ex = exercises[idx];
  if (ex.group_id == null) return null;
  const gid = ex.group_id;
  let firstIdx = idx;
  let lastIdx  = idx;
  for (let i = 0; i < exercises.length; i++) {
    if (exercises[i].group_id === gid) {
      if (i < firstIdx) firstIdx = i;
      if (i > lastIdx)  lastIdx  = i;
    }
  }
  return {
    groupId:      gid,
    type:         (ex.group_type ?? 'superset') as 'superset' | 'circuit' | 'simple',
    rounds:       ex.group_type === 'simple' ? 1 : (ex.group_rounds ?? 3),
    restTime:     ex.group_rest_time ?? 90,
    exRestTime:   ex.rest_time,
    firstIdx,
    lastIdx,
    isLastInGroup: idx === lastIdx,
  };
}

const VIBRATION_PATTERN = [0, 400, 150, 400, 150, 600];
const PRE_COUNTDOWN_S   = 5;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AllenamentoAttivoScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { cardId, planId, cardName } = route.params;

  const [card,            setCard]            = useState<WorkoutCard | null>(null);
  const [exercises,       setExercises]       = useState<CardExerciseWithName[]>([]);
  const [progress,        setProgress]        = useState<ExerciseProgress[]>([]);
  const [activeIdx,       setActiveIdx]       = useState(0);
  const [elapsed,         setElapsed]         = useState(0);
  const [isResting,       setIsResting]       = useState(false);
  const [restLeft,        setRestLeft]        = useState(0);
  const [started,         setStarted]         = useState(false);
  const [isPaused,        setIsPaused]        = useState(false);
  // Group round tracking: { [groupId]: currentRound (1-based) }
  const [groupRound,      setGroupRound]      = useState<Record<number, number>>({});

  const [bufferedSets, setBufferedSets] = useState<BufferedSetEntry[]>([]);
  const bufferedSetsRef = useRef<BufferedSetEntry[]>([]);

  const progressRef = useRef<ExerciseProgress[]>([]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const [timedPhase, setTimedPhase] = useState<TimedPhase>('idle');
  const [timedLeft,  setTimedLeft]  = useState(0);

  const enqueueBufferedSet = (entry: BufferedSetEntry) => {
    bufferedSetsRef.current = [...bufferedSetsRef.current, entry];
    setBufferedSets(bufferedSetsRef.current);
  };

  const buildBufferedSet = (
    idx: number,
    setNumber: number,
    weightStr: string,
    skipped = false,
  ): BufferedSetEntry => {
    const ex = exercisesRef.current[idx];
    return {
      exerciseName:   ex.exercise_name,
      cardExerciseId: ex.id,
      exerciseId:     ex.exercise_id,
      setNumber,
      reps:           ex.exercise_type === 'time' ? (ex.duration ?? 0) : ex.reps,
      weight:         ex.exercise_type === 'time' ? null : (weightStr ? parseFloat(weightStr) : null),
      exerciseType:   ex.exercise_type === 'time' ? 'time' : 'reps',
      skipped,
    };
  };

  const commitSetImmediately = (
    idx: number,
    setNumber: number,
    weightStr: string,
    skipped = false,
  ) => {
    enqueueBufferedSet(buildBufferedSet(idx, setNumber, weightStr, skipped));
  };

  // Refs mirror state for interval callback
  const sessionIdRef       = useRef<number | null>(null);
  const notifIdRef         = useRef<string | null>(null);
  const isRestingRef       = useRef(false);
  const restLeftRef        = useRef(0);
  const restTotalRef       = useRef(0);
  const startedRef         = useRef(false);
  const isPausedRef        = useRef(false);
  const finishedRef        = useRef(false);
  const exercisesRef       = useRef<CardExerciseWithName[]>([]);
  const activeIdxRef       = useRef(0);
  const timedPhaseRef      = useRef<TimedPhase>('idle');
  const timedLeftRef       = useRef(0);
  // Group refs
  const groupRoundRef      = useRef<Record<number, number>>({});
  const postRestIdxRef     = useRef<number | null>(null);
  const postRestGroupRef   = useRef<{ groupId: number; round: number } | null>(null);
  // Timestamp-based timing — background-safe (no tick drift)
  const workoutStartTimeRef = useRef<number | null>(null); // Date.now() when started
  const totalPausedMsRef    = useRef(0);                   // cumulative ms paused
  const pauseStartMsRef     = useRef<number | null>(null); // Date.now() when pause began
  const restEndTimeRef      = useRef<number | null>(null); // Date.now() when rest ends
  const timedStartTimeRef   = useRef<number>(0);           // Date.now() when timed phase began
  const timedTotalDurRef    = useRef<number>(0);           // duration of current timed phase (s)

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    setCard(getCard(cardId));
    const exs = getExercisesForCard(cardId);
    setExercises(exs);
    exercisesRef.current = exs;
    setProgress(exs.map((ex) => {
      const w = ex.exercise_type === 'reps'
        ? getLastWeightForExercise(ex.exercise_id, ex.reps)
        : null;
      return { currentSet: 1, weight: w != null ? String(w) : '', completed: false };
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!startedRef.current || isPausedRef.current) return;

      // ── Elapsed workout time (timestamp-based, drift-free) ──────────────────
      if (workoutStartTimeRef.current !== null) {
        const newElapsed = Math.floor(
          (Date.now() - workoutStartTimeRef.current - totalPausedMsRef.current) / 1000
        );
        setElapsed(newElapsed);
      }

      // ── Rest countdown ──────────────────────────────────────────────────────
      if (isRestingRef.current && restEndTimeRef.current !== null) {
        const newRestLeft = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        restLeftRef.current = newRestLeft;
        setRestLeft(newRestLeft);

        if (newRestLeft <= 0) {
          // Salva il set completato alla fine del recupero
          const idx = activeIdxRef.current;
          const prog = progressRef.current[idx];
          if (prog) commitSetImmediately(idx, prog.currentSet, prog.weight);

          restEndTimeRef.current  = null;
          restLeftRef.current     = 0;
          isRestingRef.current    = false;
          setIsResting(false);
          setRestLeft(0);
          if (notifIdRef.current) {
            Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
            notifIdRef.current = null;
          }
          const fb = getTimerFeedbackSync();
          if (fb === 'vibration' || fb === 'both') Vibration.vibrate(VIBRATION_PATTERN);

          // Handle post-rest navigation (group cycling)
          if (postRestIdxRef.current !== null) {
            const nextIdx = postRestIdxRef.current;
            postRestIdxRef.current = null;
            setActiveIdx(nextIdx);
          }
          if (postRestGroupRef.current !== null) {
            const { groupId, round } = postRestGroupRef.current;
            postRestGroupRef.current = null;
            const next = { ...groupRoundRef.current, [groupId]: round };
            groupRoundRef.current = next;
            setGroupRound(next);
          }
        }
        return;
      }

      // ── Timed exercise countdown ────────────────────────────────────────────
      if (timedPhaseRef.current === 'pre' || timedPhaseRef.current === 'running') {
        const phaseElapsed = Math.floor((Date.now() - timedStartTimeRef.current) / 1000);
        const newLeft = Math.max(0, timedTotalDurRef.current - phaseElapsed);
        timedLeftRef.current = newLeft;
        setTimedLeft(newLeft);

        if (newLeft <= 0) {
          if (timedPhaseRef.current === 'pre') {
            // Pre-countdown done → start exercise timer
            const ex  = exercisesRef.current[activeIdxRef.current];
            const dur = ex?.duration ?? 30;
            timedStartTimeRef.current = Date.now();
            timedTotalDurRef.current  = dur;
            timedPhaseRef.current     = 'running';
            setTimedPhase('running');
            setTimedLeft(dur);
            Vibration.vibrate([0, 200, 100, 200]);
          } else {
            // Exercise timer done → commit set
            const idx = activeIdxRef.current;
            const prog = progressRef.current[idx];
            if (prog) commitSetImmediately(idx, prog.currentSet, prog.weight);
            timedPhaseRef.current = 'done';
            setTimedPhase('done');
            setTimedLeft(0);
            const fb = getTimerFeedbackSync();
            if (fb === 'vibration' || fb === 'both') Vibration.vibrate(VIBRATION_PATTERN);
          }
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onBack = () => {
      if (!startedRef.current) return false;   // non ancora avviato → navigazione normale
      if (finishedRef.current)  return false;
      confirmAbandon();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
  }, [activeIdx]);

  const togglePause = () => {
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
    if (next) {
      // Pausing — record timestamp
      pauseStartMsRef.current = Date.now();
    } else {
      // Resuming — accumulate paused duration and shift timestamp-based timers
      if (pauseStartMsRef.current !== null) {
        const pausedMs = Date.now() - pauseStartMsRef.current;
        totalPausedMsRef.current += pausedMs;
        // Extend rest/timed end-times so they don't consume pause time
        if (restEndTimeRef.current !== null) {
          restEndTimeRef.current += pausedMs;
        }
        if (timedPhaseRef.current === 'pre' || timedPhaseRef.current === 'running') {
          timedStartTimeRef.current += pausedMs;
        }
        pauseStartMsRef.current = null;
      }
    }
  };

  const discardSession = () => {
    if (sessionIdRef.current) deleteSession(sessionIdRef.current);
    navigation.goBack();
  };

  const saveSessionAndExit = () => {
    const durationS = elapsed + 1;
    navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
  };

  const confirmAbandon = () => {
    Alert.alert(
      'Modifiche in corso',
      'Cosa vuoi fare prima di uscire?',
      [
        { text: 'Rimani', style: 'cancel' },
        { text: 'Salva', onPress: saveSessionAndExit },
        { text: 'Annulla modifiche', style: 'destructive', onPress: discardSession },
      ]
    );
  };

  const handleAvvia = () => {
    bufferedSetsRef.current = [];
    setBufferedSets([]);
    sessionIdRef.current      = createSession(planId, cardId);
    workoutStartTimeRef.current = Date.now();
    totalPausedMsRef.current    = 0;
    startedRef.current        = true;
    setStarted(true);
  };

  const updateWeight = (idx: number, value: string) => {
    setProgress((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], weight: value };
      return next;
    });
  };

  // Queue a set in the temporary buffer instead of writing immediately to the database.
  const persistSet = (exerciseIdx: number, setNumber: number, weightStr: string, skipped = false) => {
    const ex = exercisesRef.current[exerciseIdx];
    if (!sessionIdRef.current || !ex) return;
    enqueueBufferedSet(buildBufferedSet(exerciseIdx, setNumber, weightStr, skipped));
  };

  const startRest = async (restTime: number) => {
    restTotalRef.current   = restTime;
    restLeftRef.current    = restTime;
    restEndTimeRef.current = Date.now() + restTime * 1000;
    isRestingRef.current   = true;
    setRestLeft(restTime);
    setIsResting(true);
    try {
      if (notifIdRef.current) await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
      notifIdRef.current = await scheduleRestNotification(restTime);
    } catch (_) {}
  };

  const startTimedExercise = () => {
    timedStartTimeRef.current = Date.now();
    timedTotalDurRef.current  = PRE_COUNTDOWN_S;
    timedLeftRef.current      = PRE_COUNTDOWN_S;
    timedPhaseRef.current     = 'pre';
    setTimedPhase('pre');
    setTimedLeft(PRE_COUNTDOWN_S);
    Vibration.vibrate(100);
  };

  // Mark all exercises in a group as completed
  const markGroupCompleted = (groupId: number) => {
    setProgress((prev) => {
      const next = [...prev];
      exercisesRef.current.forEach((ex, i) => {
        if (ex.group_id === groupId) next[i] = { ...next[i], completed: true };
      });
      return next;
    });
  };

  // Advance past the last exercise of a group (or the whole workout)
  const advancePastGroup = (gi: GroupInfo) => {
    markGroupCompleted(gi.groupId);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (gi.lastIdx >= exercisesRef.current.length - 1) {
      finishedRef.current = true;
      const durationS = elapsed + 1;
      navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
    } else {
      setActiveIdx(gi.lastIdx + 1);
    }
  };

  // ── Standalone exercise actions ─────────────────────────────────────────────
  const handleRecupero = async (exerciseIdx?: number) => {
    const idx  = exerciseIdx ?? activeIdx;
    const prog = progress[idx];
    const ex   = exercisesRef.current[idx];
    setProgress((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], currentSet: prog.currentSet + 1 };
      return next;
    });
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    await startRest(ex.rest_time);
  };

  const handleProssimo = (exerciseIdx?: number) => {
    const idx  = exerciseIdx ?? activeIdx;
    const prog = progress[idx];
    commitSetImmediately(idx, prog.currentSet, prog.weight);
    setProgress((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], completed: true };
      return next;
    });
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (idx >= exercisesRef.current.length - 1) {
      finishedRef.current = true;
      const durationS = elapsed + 1;
      navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
    } else {
      setActiveIdx(idx + 1);
    }
  };

  // ── Group exercise actions ──────────────────────────────────────────────────

  // SUPERSET — no rest between exercises within a round
  const handleSuperset_continue = (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    commitSetImmediately(idx, round, progress[idx]?.weight ?? '');
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    setActiveIdx(idx + 1);
  };

  const handleSuperset_endRound = async (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    persistSet(idx, round, progress[idx]?.weight ?? '');
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (round < gi.rounds) {
      // Rest → cycle back to start, increment round
      const nextRound = round + 1;
      postRestIdxRef.current   = gi.firstIdx;
      postRestGroupRef.current = { groupId: gi.groupId, round: nextRound };
      await startRest(gi.restTime);
    } else {
      advancePastGroup(gi);
    }
  };

  // CIRCUIT — per-exercise rest between exercises within a round
  const handleCircuit_restNext = async (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    persistSet(idx, round, progress[idx]?.weight ?? '');
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    // Rest ex.rest_time → go to next exercise in group
    postRestIdxRef.current = idx + 1;
    await startRest(gi.exRestTime);
  };

  const handleCircuit_endRound = async (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    persistSet(idx, round, progress[idx]?.weight ?? '');
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (round < gi.rounds) {
      const nextRound = round + 1;
      postRestIdxRef.current   = gi.firstIdx;
      postRestGroupRef.current = { groupId: gi.groupId, round: nextRound };
      await startRest(gi.restTime);
    } else {
      advancePastGroup(gi);
    }
  };

  const handleTimedAction = async () => {
    if (timedPhase === 'idle') {
      startTimedExercise();
      return;
    }
    if (timedPhase !== 'done') return;
    await handleMainAction();
  };

  const handleGroupAction = async (gi: GroupInfo) => {
    if (gi.type === 'superset') {
      if (!gi.isLastInGroup) {
        handleSuperset_continue(activeIdx, gi);
      } else {
        await handleSuperset_endRound(activeIdx, gi);
      }
    } else { // circuit
      if (!gi.isLastInGroup) {
        await handleCircuit_restNext(activeIdx, gi);
      } else {
        await handleCircuit_endRound(activeIdx, gi);
      }
    }
  };

  const handleSkip = () => {
    const idx = activeIdx;
    const ex = exercisesRef.current[idx];
    if (!ex) return;
    const prog = progress[idx] ?? { currentSet: 1, weight: '', completed: false };
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');

    if (gi) {
      const round = groupRoundRef.current[gi.groupId] ?? 1;
      if (gi.type === 'superset') {
        if (!gi.isLastInGroup) {
          setActiveIdx(idx + 1);
          return;
        }
        if (round < gi.rounds) {
          const nextRound = round + 1;
          const next = { ...groupRoundRef.current, [gi.groupId]: nextRound };
          groupRoundRef.current = next;
          setGroupRound(next);
          setActiveIdx(gi.firstIdx);
        } else {
          advancePastGroup(gi);
        }
      } else if (gi.type === 'circuit') {
        if (!gi.isLastInGroup) {
          setActiveIdx(idx + 1);
          return;
        }
        if (round < gi.rounds) {
          const nextRound = round + 1;
          const next = { ...groupRoundRef.current, [gi.groupId]: nextRound };
          groupRoundRef.current = next;
          setGroupRound(next);
          setActiveIdx(gi.firstIdx);
        } else {
          advancePastGroup(gi);
        }
      } else {
        // simple — skip set by set like standalone
        const simpleIsLastSet = prog.currentSet >= (ex.sets ?? 1);
        if (!simpleIsLastSet) {
          setProgress((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], currentSet: prog.currentSet + 1 };
            return next;
          });
        } else {
          setProgress((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], completed: true };
            return next;
          });
          if (!gi.isLastInGroup) {
            setActiveIdx(idx + 1);
          } else if (gi.lastIdx >= exercisesRef.current.length - 1) {
            finishedRef.current = true;
            const durationS = elapsed + 1;
            navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
          } else {
            setActiveIdx(gi.lastIdx + 1);
          }
        }
      }
    } else {
      const isLastSet = prog.currentSet >= (ex.sets ?? 1);
      if (isLastSet) {
        setProgress((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], completed: true };
          return next;
        });
        if (idx >= exercisesRef.current.length - 1) {
          finishedRef.current = true;
          const durationS = elapsed + 1;
          navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
        } else {
          setActiveIdx(idx + 1);
        }
      } else {
        setProgress((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], currentSet: prog.currentSet + 1 };
          return next;
        });
      }
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (exercises.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Nessun esercizio in questa scheda.</Text>
      </View>
    );
  }

  const currentEx   = exercises[activeIdx];
  const currentProg = progress[activeIdx] ?? { currentSet: 1, weight: '', completed: false };
  const gi          = getGroupInfo(exercises, activeIdx);
  const inGroup     = gi !== null;
  const curRound    = inGroup ? (groupRound[gi!.groupId] ?? 1) : 1;
  const effectiveSets = inGroup && gi!.type !== 'simple' ? gi!.rounds : (currentEx?.sets ?? 1);
  const isLastSet   = inGroup && gi!.type !== 'simple'
    ? (curRound >= gi!.rounds)
    : (currentProg.currentSet >= (currentEx?.sets ?? 1));
  const restPct     = restTotalRef.current > 0 ? (restLeft / restTotalRef.current) * 100 : 0;
  const isTimedEx   = currentEx?.exercise_type === 'time';
  const isBodyweightEx = currentEx?.exercise_type === 'bodyweight';

  // Completed count: collapse groups
  const processedGroups = new Set<number>();
  let completedCount = 0;
  let totalCount     = 0;
  exercises.forEach((ex, idx) => {
    if (ex.group_id != null) {
      if (!processedGroups.has(ex.group_id)) {
        processedGroups.add(ex.group_id);
        totalCount++;
        // Group is "completed" if ALL exercises in it are marked done
        const groupExIdxs = exercises
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.group_id === ex.group_id)
          .map(({ i }) => i);
        if (groupExIdxs.every(i => progress[i]?.completed)) completedCount++;
      }
    } else {
      totalCount++;
      if (progress[idx]?.completed) completedCount++;
    }
  });

  // Timed label
  const timedActionLabel = (): string => {
    switch (timedPhase) {
      case 'idle':    return 'Inizia serie';
      case 'pre':     return `Preparati... ${timedLeft}s`;
      case 'running': return `In corso  ${timedLeft}s`;
      case 'done': {
        if (inGroup && gi!.type !== 'simple') {
          if (gi!.type === 'superset' && !gi!.isLastInGroup) return 'Prosegui →';
          if (isLastSet) return gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio';
          return gi!.type === 'superset' ? `Recupero (${gi!.restTime}s)` : `Fine giro ${curRound}/${gi!.rounds}`;
        }
        // standalone or simple group
        const isEnd = inGroup
          ? (gi!.isLastInGroup && gi!.lastIdx >= exercises.length - 1)
          : (activeIdx >= exercises.length - 1);
        return isLastSet ? (isEnd ? 'Fine allenamento' : 'Prossimo esercizio') : 'Recupero';
      }
    }
  };

  // ── Action button label & color ─────────────────────────────────────────────
  let actionLabel = '';
  let actionColor: string = COLORS.primary;
  let actionIcon  = 'arrow-right';

  if (inGroup && gi!.type !== 'simple') {
    if (gi!.type === 'superset') {
      if (!gi!.isLastInGroup) {
        actionLabel = 'Prosegui →';
        actionColor = COLORS.accent;
        actionIcon  = 'bolt';
      } else if (isLastSet) {
        actionLabel = gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Fine superserie';
        actionColor = COLORS.success;
        actionIcon  = gi!.lastIdx >= exercises.length - 1 ? 'trophy' : 'check';
      } else {
        actionLabel = `Recupero (${formatTime(gi!.restTime)})`;
        actionColor = COLORS.primary;
        actionIcon  = 'stopwatch';
      }
    } else { // circuit
      if (!gi!.isLastInGroup) {
        actionLabel = `Recupero (${formatTime(gi!.exRestTime)})`;
        actionColor = COLORS.primary;
        actionIcon  = 'stopwatch';
      } else if (isLastSet) {
        actionLabel = gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Fine circuito';
        actionColor = COLORS.success;
        actionIcon  = gi!.lastIdx >= exercises.length - 1 ? 'trophy' : 'check';
      } else {
        actionLabel = `Fine giro ${curRound}/${gi!.rounds} · Recupero (${formatTime(gi!.restTime)})`;
        actionColor = COLORS.primary;
        actionIcon  = 'redo-alt';
      }
    }
  } else {
    // standalone or simple group — each exercise runs its own sets
    if (!isLastSet) {
      actionLabel = `Recupero (${currentEx?.rest_time}s)`;
      actionColor = COLORS.primary;
      actionIcon  = 'stopwatch';
    } else {
      const isEnd = inGroup
        ? (gi!.isLastInGroup && gi!.lastIdx >= exercises.length - 1)
        : (activeIdx >= exercises.length - 1);
      actionLabel = isEnd ? 'Fine allenamento' : 'Prossimo esercizio';
      actionColor = COLORS.success;
      actionIcon  = isEnd ? 'trophy' : 'arrow-right';
    }
  }

  const handleMainAction = async () => {
    if (inGroup && gi!.type !== 'simple') {
      await handleGroupAction(gi!);
    } else if (isLastSet) {
      if (inGroup && gi!.type === 'simple') {
        // Simple group: commit set, mark exercise done, advance within group or past it
        commitSetImmediately(activeIdx, currentProg.currentSet, currentProg.weight);
        setProgress((prev) => {
          const next = [...prev];
          next[activeIdx] = { ...next[activeIdx], completed: true };
          return next;
        });
        timedPhaseRef.current = 'idle';
        setTimedPhase('idle');
        if (gi!.isLastInGroup) {
          if (gi!.lastIdx >= exercisesRef.current.length - 1) {
            finishedRef.current = true;
            const durationS = elapsed + 1;
            navigation.replace('Riepilogo', { sessionId: sessionIdRef.current!, durationS, bufferedSets: bufferedSetsRef.current });
          } else {
            setActiveIdx(gi!.lastIdx + 1);
          }
        } else {
          setActiveIdx(activeIdx + 1);
        }
      } else {
        handleProssimo();
      }
    } else {
      await handleRecupero();
    }
  };

  return (
    <View style={styles.container}>

      {/* Timer bar */}
      <View style={styles.timerBar}>
        <View style={styles.timerBarTop}>
          <View style={styles.timerLeft}>
            <FontAwesome5 name="stopwatch" size={15} color={started ? COLORS.primary : COLORS.textMuted} solid />
            <Text style={[styles.timerValue, (!started || isPaused) && styles.timerValuePaused]}>
              {formatTime(elapsed)}
            </Text>
          </View>
          <View style={styles.timerCenter}>
            <Text style={styles.cardNameLabel} numberOfLines={1}>{cardName}</Text>
            <Text style={styles.progressLabel}>{completedCount}/{totalCount}</Text>
          </View>
          <View style={styles.timerControls}>
          {started && (
            <TouchableOpacity
              style={[styles.timerBtn, isPaused && styles.timerBtnActive]}
              onPress={togglePause}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name={isPaused ? 'play' : 'pause'}
                size={13}
                color={isPaused ? COLORS.primary : COLORS.textSub}
                solid
              />
            </TouchableOpacity>
          )}
          {started && (
            <TouchableOpacity
              style={[styles.timerBtn, styles.timerBtnStop]}
              onPress={confirmAbandon}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="stop" size={13} color={COLORS.danger} solid />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {card?.notes ? (
        <>
          <View style={styles.timerBarSep} />
          <Text style={styles.cardNotesLabel} numberOfLines={2}>{card.notes}</Text>
        </>
      ) : null}
      </View>

      {/* Lista esercizi */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {(() => {
          // Render with group visual blocks
          const rendered: React.ReactNode[] = [];
          const seenGroups = new Set<number>();

          exercises.forEach((ex, idx) => {
            const prog     = progress[idx] ?? { currentSet: 1, weight: '', completed: false };
            const isActive = idx === activeIdx;
            const isDone   = prog.completed;
            const isTimed  = ex.exercise_type === 'time';
            const exGi     = getGroupInfo(exercises, idx);

            if (exGi && !seenGroups.has(exGi.groupId)) {
              seenGroups.add(exGi.groupId);
              // Render group header
              const typeLabel = exGi.type === 'superset' ? 'SUPERSERIE'
                : exGi.type === 'circuit' ? 'CIRCUITO'
                : 'GRUPPO';
              const typeColor = exGi.type === 'superset' ? COLORS.accent
                : exGi.type === 'circuit' ? COLORS.primary
                : COLORS.success;
              const curGrpRound = groupRound[exGi.groupId] ?? 1;
              // Group exercises
              const groupExs = exercises
                .map((e, i) => ({ e, i }))
                .filter(({ e }) => e.group_id === exGi.groupId);
              const groupDone = groupExs.every(({ i }) => progress[i]?.completed);

              rendered.push(
                <View
                  key={`grp-${exGi.groupId}`}
                  style={[
                    styles.groupBlock,
                    activeIdx >= exGi.firstIdx && activeIdx <= exGi.lastIdx && styles.groupBlockActive,
                    groupDone && styles.groupBlockDone,
                  ]}
                >
                  {/* Group bar */}
                  <View style={[styles.groupBar, { backgroundColor: typeColor }]} />
                  {/* Group header */}
                  <View style={styles.groupBlockHeader}>
                    <Text style={[styles.groupBlockLabel, { color: typeColor }]}>{typeLabel}</Text>
                    <Text style={styles.groupBlockMeta}>
                      {groupDone
                        ? (exGi.type === 'simple' ? 'Completato' : `${exGi.rounds} giri completati`)
                        : (exGi.type === 'simple'
                            ? 'Esercizi con serie complete'
                            : `Giro ${curGrpRound} di ${exGi.rounds}  ·  Recupero ${formatTime(exGi.restTime)}`)
                      }
                    </Text>
                    {groupDone && (
                      <FontAwesome5 name="flag-checkered" size={13} color={COLORS.success} solid />
                    )}
                  </View>
                  {/* Group exercises */}
                  {groupExs.map(({ e, i }) => {
                    const gProg    = progress[i] ?? { currentSet: 1, weight: '', completed: false };
                    const gActive  = i === activeIdx;
                    const gDone    = gProg.completed;
                    const gTimed   = e.exercise_type === 'time';
                    return (
                      <View key={e.id} style={styles.groupExRow}>
                        <View style={styles.indicator}>
                          {gDone ? (
                            <FontAwesome5 name="check" size={12} color={COLORS.success} solid />
                          ) : gActive ? (
                            <FontAwesome5 name="play" size={11} color={typeColor} solid />
                          ) : (
                            <View style={styles.dotIcon} />
                          )}
                        </View>
                        <View style={styles.exerciseInfo}>
                          <Text style={[styles.exerciseName, gActive && { color: COLORS.text }]}>
                            {e.exercise_name}
                          </Text>
                          <View style={styles.tagsRow}>
                            {exGi.type === 'simple' && (
                              <View style={styles.tag}>
                                <FontAwesome5 name="layer-group" size={9} color={COLORS.textMuted} solid />
                                <Text style={styles.tagText}>{e.sets} serie</Text>
                              </View>
                            )}
                            {gTimed ? (
                              <View style={[styles.tag, styles.tagTime]}>
                                <FontAwesome5 name="stopwatch" size={9} color={COLORS.accent} solid />
                                <Text style={[styles.tagText, { color: COLORS.accent }]}>{e.duration ?? '—'}s</Text>
                              </View>
                            ) : e.exercise_type === 'bodyweight' ? (
                              <View style={[styles.tag, styles.tagBodyweight]}>
                                <FontAwesome5 name="running" size={9} color={COLORS.success} solid />
                                <Text style={[styles.tagText, { color: COLORS.success }]}>{e.reps} reps</Text>
                              </View>
                            ) : (
                              <View style={styles.tag}>
                                <FontAwesome5 name="dumbbell" size={9} color={COLORS.textMuted} solid />
                                <Text style={styles.tagText}>{e.reps} reps</Text>
                              </View>
                            )}
                            {(() => {
                              if (exGi.type === 'simple') {
                                return (
                                  <View style={styles.tag}>
                                    <FontAwesome5 name="stopwatch" size={9} color={COLORS.textMuted} solid />
                                    <Text style={styles.tagText}>{e.rest_time}s</Text>
                                  </View>
                                );
                              }
                              if (exGi.type === 'circuit') {
                                const isLastExerciseInGroup = e.id === exercises[exGi.lastIdx]?.id;
                                return !isLastExerciseInGroup && (
                                  <View style={styles.tag}>
                                    <FontAwesome5 name="stopwatch" size={9} color={COLORS.textMuted} solid />
                                    <Text style={styles.tagText}>{e.rest_time}s</Text>
                                  </View>
                                );
                              }
                              return null;
                            })()}
                          </View>
                          {gActive && !gDone && started && (
                            <View style={styles.activeDetails}>
                              <Text style={[styles.setLabel, { color: typeColor }]}>
                                {exGi.type === 'simple'
                                  ? `Serie ${gProg.currentSet} di ${e.sets}`
                                  : `Giro ${curGrpRound} di ${exGi.rounds}`}
                              </Text>
                              {gTimed ? (
                                <View style={styles.timedBox}>
                                  {timedPhase === 'idle' && (
                                    <Text style={styles.timedHint}>Premi "Inizia serie" per avviare il conto alla rovescia</Text>
                                  )}
                                  {timedPhase === 'pre' && (
                                    <View style={styles.timedCountdownWrap}>
                                      <Text style={styles.timedPreLabel}>Preparati!</Text>
                                      <Text style={styles.timedCountdown}>{timedLeft}</Text>
                                    </View>
                                  )}
                                  {timedPhase === 'running' && (
                                    <View style={styles.timedCountdownWrap}>
                                      <Text style={styles.timedRunLabel}>In corso</Text>
                                      <Text style={[styles.timedCountdown, { color: COLORS.accent }]}>{timedLeft}s</Text>
                                      <View style={styles.timedProgressBg}>
                                        <View style={[styles.timedProgressFill, { width: `${(timedLeft / (e.duration ?? 30)) * 100}%` as any }]} />
                                      </View>
                                    </View>
                                  )}
                                  {timedPhase === 'done' && (
                                    <View style={styles.timedDoneWrap}>
                                      <FontAwesome5 name="check-circle" size={22} color={COLORS.success} solid />
                                      <Text style={styles.timedDoneLabel}>Completata!</Text>
                                    </View>
                                  )}
                                </View>
                              ) : e.exercise_type === 'bodyweight' ? (
                                <View style={styles.bodyweightBox}>
                                  <FontAwesome5 name="running" size={18} color={COLORS.success} solid />
                                  <Text style={styles.bodyweightLabel}>Corpo libero</Text>
                                </View>
                              ) : (
                                <View style={styles.weightRow}>
                                  <Text style={styles.weightLabel}>Peso (kg)</Text>
                                  <TextInput
                                    style={styles.weightInput}
                                    value={gProg.weight}
                                    onChangeText={(v) => updateWeight(i, v)}
                                    placeholder="—"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="decimal-pad"
                                    returnKeyType="done"
                                  />
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            } else if (!exGi) {
              // Standalone exercise row
              rendered.push(
                <View
                  key={ex.id}
                  style={[
                    styles.exerciseRow,
                    isActive && styles.exerciseRowActive,
                    isDone   && styles.exerciseRowDone,
                  ]}
                >
                  {isActive && <View style={styles.activeBar} />}
                  <View style={styles.indicator}>
                    {isDone ? (
                      <FontAwesome5 name="flag-checkered" size={16} color={COLORS.success} solid />
                    ) : isActive ? (
                      <FontAwesome5 name="play" size={14} color={COLORS.primary} solid />
                    ) : (
                      <View style={styles.dotIcon} />
                    )}
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, isActive && styles.exerciseNameActive]}>
                      {ex.exercise_name}
                    </Text>
                    <View style={styles.tagsRow}>
                      <View style={styles.tag}>
                        <FontAwesome5 name="layer-group" size={9} color={COLORS.textMuted} solid />
                        <Text style={styles.tagText}>{ex.sets} serie</Text>
                      </View>
                      {isTimed ? (
                        <View style={[styles.tag, styles.tagTime]}>
                          <FontAwesome5 name="stopwatch" size={9} color={COLORS.accent} solid />
                          <Text style={[styles.tagText, { color: COLORS.accent }]}>{ex.duration ?? '—'}s</Text>
                        </View>
                      ) : ex.exercise_type === 'bodyweight' ? (
                        <View style={[styles.tag, styles.tagBodyweight]}>
                          <FontAwesome5 name="running" size={9} color={COLORS.success} solid />
                          <Text style={[styles.tagText, { color: COLORS.success }]}>{ex.reps} reps</Text>
                        </View>
                      ) : (
                        <View style={styles.tag}>
                          <FontAwesome5 name="dumbbell" size={9} color={COLORS.textMuted} solid />
                          <Text style={styles.tagText}>{ex.reps} reps</Text>
                        </View>
                      )}
                      <View style={styles.tag}>
                        <FontAwesome5 name="stopwatch" size={9} color={COLORS.textMuted} solid />
                        <Text style={styles.tagText}>{ex.rest_time}s</Text>
                      </View>
                    </View>

                    {isActive && !isDone && started && (
                      <View style={styles.activeDetails}>
                        <Text style={styles.setLabel}>
                          Serie {prog.currentSet} di {ex.sets}
                        </Text>
                        {isTimed ? (
                          <View style={styles.timedBox}>
                            {timedPhase === 'idle' && (
                              <Text style={styles.timedHint}>Premi "Inizia serie" per avviare il conto alla rovescia</Text>
                            )}
                            {timedPhase === 'pre' && (
                              <View style={styles.timedCountdownWrap}>
                                <Text style={styles.timedPreLabel}>Preparati!</Text>
                                <Text style={styles.timedCountdown}>{timedLeft}</Text>
                              </View>
                            )}
                            {timedPhase === 'running' && (
                              <View style={styles.timedCountdownWrap}>
                                <Text style={styles.timedRunLabel}>In corso</Text>
                                <Text style={[styles.timedCountdown, { color: COLORS.accent }]}>{timedLeft}s</Text>
                                <View style={styles.timedProgressBg}>
                                  <View style={[styles.timedProgressFill, { width: `${(timedLeft / (ex.duration ?? 30)) * 100}%` as any }]} />
                                </View>
                              </View>
                            )}
                            {timedPhase === 'done' && (
                              <View style={styles.timedDoneWrap}>
                                <FontAwesome5 name="check-circle" size={22} color={COLORS.success} solid />
                                <Text style={styles.timedDoneLabel}>Completata!</Text>
                              </View>
                            )}
                          </View>
                        ) : ex.exercise_type === 'bodyweight' ? (
                          <View style={styles.bodyweightBox}>
                            <FontAwesome5 name="running" size={18} color={COLORS.success} solid />
                            <Text style={styles.bodyweightLabel}>Corpo libero</Text>
                          </View>
                        ) : (
                          <View style={styles.weightRow}>
                            <Text style={styles.weightLabel}>Peso (kg)</Text>
                            <TextInput
                              style={styles.weightInput}
                              value={prog.weight}
                              onChangeText={(v) => updateWeight(idx, v)}
                              placeholder="—"
                              placeholderTextColor={COLORS.textMuted}
                              keyboardType="decimal-pad"
                              returnKeyType="done"
                            />
                          </View>
                        )}
                      </View>
                    )}

                    {isDone && (
                      <View style={styles.doneRow}>
                        <FontAwesome5 name="check-circle" size={12} color={COLORS.success} solid />
                        <Text style={styles.doneLabel}>Completato</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }
          });
          return rendered;
        })()}
      </ScrollView>

      {/* Zona pulsanti */}
      {!started ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAvvia]} onPress={handleAvvia} activeOpacity={0.85}>
            <FontAwesome5 name="play" size={16} color={COLORS.white} solid />
            <Text style={styles.actionBtnText}>Avvia allenamento</Text>
          </TouchableOpacity>
        </View>
      ) : isPaused ? (
        <View style={styles.pauseZone}>
          <FontAwesome5 name="pause-circle" size={32} color={COLORS.textMuted} solid />
          <Text style={styles.pauseLabel}>In pausa</Text>
          <TouchableOpacity style={styles.resumeBtn} onPress={togglePause} activeOpacity={0.85}>
            <FontAwesome5 name="play" size={15} color={COLORS.white} solid />
            <Text style={styles.resumeBtnText}>Riprendi</Text>
          </TouchableOpacity>
        </View>
      ) : isResting ? (
        <View style={styles.restZone}>
          <View style={styles.restInfo}>
            <Text style={styles.restTitle}>Recupero</Text>
            <Text style={styles.restTimer}>{formatTime(restLeft)}</Text>
          </View>
          <View style={styles.restProgressBg}>
            <View style={[styles.restProgressFill, { width: `${restPct}%` as any }]} />
          </View>
        </View>
      ) : isTimedEx ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="forward" size={16} color={COLORS.white} solid />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              timedPhase === 'idle'    ? styles.actionBtnTimedIdle :
              timedPhase === 'pre'     ? styles.actionBtnTimedPre  :
              timedPhase === 'running' ? styles.actionBtnTimedRun  :
              { backgroundColor: actionColor },
            ]}
            onPress={handleTimedAction}
            disabled={timedPhase === 'pre' || timedPhase === 'running'}
            activeOpacity={0.85}
          >
            <FontAwesome5
              name={
                timedPhase === 'idle'    ? 'play' :
                timedPhase === 'pre'     ? 'hourglass-start' :
                timedPhase === 'running' ? 'hourglass-half' : actionIcon
              }
              size={16} color={COLORS.white} solid
            />
            <Text style={styles.actionBtnText}>{timedActionLabel()}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="forward" size={16} color={COLORS.white} solid />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: actionColor }]}
            onPress={handleMainAction}
            activeOpacity={0.85}
          >
            <FontAwesome5 name={actionIcon} size={16} color={COLORS.white} solid />
            <Text style={styles.actionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  emptyText:  { color: COLORS.textSub, fontSize: 16 },

  timerBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timerBarTop: { flexDirection: 'row', alignItems: 'center' },
  timerBarSep: { height: 1, backgroundColor: COLORS.border, marginTop: 8, marginHorizontal: -12 },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timerValue: {
    color: COLORS.text, fontSize: 21, fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerValuePaused: { color: COLORS.textMuted },
  timerCenter: { flex: 1, alignItems: 'center' },
  cardNameLabel: { color: COLORS.textSub, fontSize: 12, fontWeight: '500' },
  progressLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  cardNotesLabel: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 7, lineHeight: 16 },
  timerControls: { flexDirection: 'row', gap: 8 },
  timerBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  timerBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  timerBtnStop:   { borderColor: COLORS.danger + '50' },

  list:        { flex: 1 },
  listContent: { padding: 12, gap: 8, paddingBottom: 24 },

  exerciseRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    padding: 14,
    flexDirection: 'row',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exerciseRowActive: { backgroundColor: COLORS.surface, elevation: 3 },
  exerciseRowDone:   { opacity: 0.5 },
  activeBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: COLORS.primary,
  },

  // Group block
  groupBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupBlockActive: { elevation: 3, borderColor: COLORS.accent + '60' },
  groupBlockDone:   { opacity: 0.5 },
  groupBar: {
    height: 3,
  },
  groupBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupBlockLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  groupBlockMeta:  { flex: 1, color: COLORS.textMuted, fontSize: 11 },

  groupExRow: {
    flexDirection: 'row',
    padding: 12,
    paddingLeft: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '60',
  },

  indicator:  { width: 28, alignItems: 'center', paddingTop: 3 },
  dotIcon:    { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.border, marginTop: 4 },

  exerciseInfo:        { flex: 1 },
  exerciseName:        { color: COLORS.textSub, fontSize: 15, fontWeight: '600', marginBottom: 5 },
  exerciseNameActive:  { color: COLORS.text, fontSize: 16 },
  tagsRow:             { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  tagTime:       { backgroundColor: COLORS.accent  + '22' },
  tagBodyweight: { backgroundColor: COLORS.success + '22' },
  tagText: { color: COLORS.textMuted, fontSize: 11 },

  activeDetails: { marginTop: 14, gap: 10 },
  setLabel:      { color: COLORS.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  weightRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weightLabel:   { color: COLORS.textSub, fontSize: 14, width: 72 },
  weightInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.text,
    fontSize: 26, fontWeight: '700',
    borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border,
    textAlign: 'center',
  },
  bodyweightBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.success + '18',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  bodyweightLabel: { color: COLORS.success, fontSize: 14, fontWeight: '600' },

  doneRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  doneLabel: { color: COLORS.success, fontSize: 12, fontWeight: '600' },

  timedBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  timedHint: { color: COLORS.textSub, fontSize: 13, textAlign: 'center' },
  timedCountdownWrap: { alignItems: 'center', gap: 4 },
  timedPreLabel: { color: COLORS.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  timedRunLabel: { color: COLORS.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  timedCountdown: {
    color: COLORS.text, fontSize: 52, fontWeight: '700',
    fontVariant: ['tabular-nums'], lineHeight: 60,
  },
  timedProgressBg: {
    height: 5, backgroundColor: COLORS.border,
    borderRadius: 3, overflow: 'hidden',
    width: '100%', marginTop: 8,
  },
  timedProgressFill: {
    height: 5, backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  timedDoneWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timedDoneLabel: { color: COLORS.success, fontSize: 16, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, gap: 10,
  },
  actionBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  skipBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnAvvia:    { backgroundColor: COLORS.success },
  actionBtnTimedIdle:{ backgroundColor: COLORS.accent },
  actionBtnTimedPre: { backgroundColor: COLORS.surfaceAlt },
  actionBtnTimedRun: { backgroundColor: COLORS.surfaceAlt },
  actionBtnText:     { color: COLORS.white, fontSize: 17, fontWeight: '700' },

  pauseZone: {
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  pauseLabel: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  resumeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
  },
  resumeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  restZone: {
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    elevation: 2,
  },
  restInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  restTitle: { color: COLORS.textSub, fontSize: 14, fontWeight: '600' },
  restTimer: {
    color: COLORS.text, fontSize: 36, fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  restProgressBg: {
    height: 6, backgroundColor: COLORS.surfaceAlt,
    borderRadius: 3, overflow: 'hidden',
  },
  restProgressFill: {
    height: 6, backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
});
