import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, BackHandler, Vibration,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { COLORS } from '../../theme/colors';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getTimerFeedbackSync } from '../../utils/settings';
import { getExercisesForCard, getLastWeightForExercise } from '../../database/cardExerciseRepository';
import { getCard } from '../../database/cardRepository';
import { bulkSaveAndFinalize } from '../../database/sessionRepository';
import { createDraft, updateDraftProgress, readDraft, deleteDraft, effectiveSets } from '../../utils/sessionDraft';
import type { CardExerciseWithName, WorkoutCard } from '../../types';
import type { WorkoutStackParamList } from '../../navigation/types';

type NavProp    = NativeStackNavigationProp<WorkoutStackParamList, 'AllenamentoAttivo'>;
type RouteProps = RouteProp<WorkoutStackParamList, 'AllenamentoAttivo'>;

interface ExerciseProgress {
  currentSet: number;
  weights:    string[];   // one slot per set/round, indexed by (setNumber - 1)
  completed:  boolean;
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
  const [abandonDialog,   setAbandonDialog]   = useState(false);
  // Group round tracking: { [groupId]: currentRound (1-based) }
  const [groupRound,      setGroupRound]      = useState<Record<number, number>>({});

  const [timedPhase, setTimedPhase] = useState<TimedPhase>('idle');
  const [timedLeft,  setTimedLeft]  = useState(0);

  // Refs mirror state for interval callback
  const draftStartedAtRef  = useRef<string>(new Date().toISOString());
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

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    setCard(getCard(cardId));
    const exs = getExercisesForCard(cardId);
    setExercises(exs);
    exercisesRef.current = exs;

    const freshProgress = (): ExerciseProgress[] =>
      exs.map((ex) => {
        const nSets = effectiveSets(ex);
        const w = ex.exercise_type === 'reps'
          ? getLastWeightForExercise(ex.exercise_id, ex.reps)
          : null;
        const ws = w != null ? String(w) : '';
        return { currentSet: 1, weights: Array(nSets).fill(ws), completed: false };
      });

    readDraft().then(draft => {
      if (draft && draft.cardId === cardId && draft.planId === planId) {
        // Recover interrupted workout
        draftStartedAtRef.current = draft.startedAt;
        setProgress(exs.map((_, i) => {
          const saved = draft.progress.exercises[i];
          const nSets = effectiveSets(exs[i]);
          return {
            currentSet: saved?.currentSet ?? 1,
            weights:    saved?.weights ?? Array(nSets).fill(''),
            completed:  saved?.isDone ?? false,
          };
        }));
        setElapsed(draft.progress.elapsedS);
        const restoredActiveIdx = draft.progress.activeIdx;
        setActiveIdx(restoredActiveIdx);
        activeIdxRef.current = restoredActiveIdx;
        const gr: Record<number, number> = {};
        Object.entries(draft.progress.groupRound).forEach(([k, v]) => {
          gr[Number(k)] = v;
        });
        groupRoundRef.current = gr;
        setGroupRound(gr);
        startedRef.current = true;
        setStarted(true);
      } else {
        setProgress(freshProgress());
      }
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!startedRef.current || isPausedRef.current) return;

      setElapsed((prev) => prev + 1);

      if (isRestingRef.current) {
        if (restLeftRef.current <= 1) {
          restLeftRef.current  = 0;
          isRestingRef.current = false;
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
        } else {
          restLeftRef.current -= 1;
          setRestLeft(restLeftRef.current);
        }
        return;
      }

      // Timed exercise countdown
      if (timedPhaseRef.current === 'pre') {
        if (timedLeftRef.current <= 1) {
          const ex  = exercisesRef.current[activeIdxRef.current];
          const dur = ex?.duration ?? 30;
          timedLeftRef.current  = dur;
          timedPhaseRef.current = 'running';
          setTimedPhase('running');
          setTimedLeft(dur);
          Vibration.vibrate([0, 200, 100, 200]);
        } else {
          timedLeftRef.current -= 1;
          setTimedLeft(timedLeftRef.current);
        }
      } else if (timedPhaseRef.current === 'running') {
        if (timedLeftRef.current <= 1) {
          timedLeftRef.current  = 0;
          timedPhaseRef.current = 'done';
          setTimedPhase('done');
          setTimedLeft(0);
          const fb = getTimerFeedbackSync();
          if (fb === 'vibration' || fb === 'both') Vibration.vibrate(VIBRATION_PATTERN);
        } else {
          timedLeftRef.current -= 1;
          setTimedLeft(timedLeftRef.current);
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
  };

  const confirmAbandon = () => setAbandonDialog(true);

  const handleAvvia = () => {
    const startedAt = new Date().toISOString();
    draftStartedAtRef.current = startedAt;
    createDraft(planId, cardId, cardName, startedAt, exercisesRef.current,
      progress.map(p => p.weights)).catch(() => {});
    startedRef.current = true;
    setStarted(true);
  };

  const updateWeight = (idx: number, setIdx: number, value: string) => {
    setProgress((prev) => {
      const next = [...prev];
      const weights = [...next[idx].weights];
      weights[setIdx] = value;
      next[idx] = { ...next[idx], weights };
      return next;
    });
  };

  // Fire-and-forget: persiste lo stato corrente nel draft JSON
  const saveDraftProgress = (prog: ExerciseProgress[], currentElapsed: number) => {
    updateDraftProgress({
      elapsedS:   currentElapsed,
      activeIdx:  activeIdxRef.current,
      groupRound: groupRoundRef.current as Record<string, number>,
      exercises:  prog.map(p => ({
        weights:    p.weights,
        isDone:     p.completed,
        currentSet: p.currentSet,
      })),
    });
  };

  // Bulk-save nel DB, cancella il draft (await), poi naviga al riepilogo
  const finishWorkout = async (finalProgress: ExerciseProgress[], durationS: number) => {
    const sessionId = bulkSaveAndFinalize(
      planId,
      cardId,
      draftStartedAtRef.current,
      durationS,
      exercisesRef.current.map(ex => ({
        cardExerciseId: ex.id,
        exerciseId:     ex.exercise_id,
        sets:           ex.sets,
        reps:           ex.reps,
        exerciseType:   ex.exercise_type,
        duration:       ex.duration,
        groupId:        ex.group_id,
        groupRounds:    ex.group_rounds,
      })),
      finalProgress.map(p => ({
        weights:    p.weights,
        isDone:     p.completed,
        currentSet: p.currentSet,
      }))
    );
    await deleteDraft();
    navigation.replace('Riepilogo', { sessionId, durationS });
  };

  const startRest = async (restTime: number) => {
    restTotalRef.current = restTime;
    restLeftRef.current  = restTime;
    isRestingRef.current = true;
    setRestLeft(restTime);
    setIsResting(true);
    try {
      if (notifIdRef.current) await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
      notifIdRef.current = await scheduleRestNotification(restTime);
    } catch (_) {}
  };

  const startTimedExercise = () => {
    timedLeftRef.current  = PRE_COUNTDOWN_S;
    timedPhaseRef.current = 'pre';
    setTimedPhase('pre');
    setTimedLeft(PRE_COUNTDOWN_S);
    Vibration.vibrate(100);
  };

  // Advance past the last exercise of a group (or the whole workout)
  const advancePastGroup = (gi: GroupInfo) => {
    const newProgress = progress.map((p, i) => {
      const ex = exercisesRef.current[i];
      return ex?.group_id === gi.groupId ? { ...p, completed: true } : p;
    });
    setProgress(newProgress);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (gi.lastIdx >= exercisesRef.current.length - 1) {
      finishedRef.current = true;
      finishWorkout(newProgress, elapsed + 1);
    } else {
      saveDraftProgress(newProgress, elapsed);
      setActiveIdx(gi.lastIdx + 1);
    }
  };

  // ── Standalone exercise actions ─────────────────────────────────────────────
  const handleRecupero = async (exerciseIdx?: number) => {
    const idx  = exerciseIdx ?? activeIdx;
    const prog = progress[idx];
    const ex   = exercisesRef.current[idx];
    const newProgress = progress.map((p, i) =>
      i === idx ? { ...p, currentSet: prog.currentSet + 1 } : p
    );
    setProgress(newProgress);
    saveDraftProgress(newProgress, elapsed);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    await startRest(ex.rest_time);
  };

  const handleProssimo = (exerciseIdx?: number) => {
    const idx  = exerciseIdx ?? activeIdx;
    const newProgress = progress.map((p, i) =>
      i === idx ? { ...p, completed: true } : p
    );
    setProgress(newProgress);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    if (idx >= exercisesRef.current.length - 1) {
      finishedRef.current = true;
      finishWorkout(newProgress, elapsed + 1);
    } else {
      saveDraftProgress(newProgress, elapsed);
      setActiveIdx(idx + 1);
    }
  };

  // ── Group exercise actions ──────────────────────────────────────────────────

  // SUPERSET — no rest between exercises within a round
  const handleSuperset_continue = (idx: number, _gi: GroupInfo) => {
    saveDraftProgress(progress, elapsed);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    setActiveIdx(idx + 1);
  };

  const handleSuperset_endRound = async (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    saveDraftProgress(progress, elapsed);
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

  // CIRCUIT — per-exercise rest between exercises within a round
  const handleCircuit_restNext = async (idx: number, gi: GroupInfo) => {
    saveDraftProgress(progress, elapsed);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    postRestIdxRef.current = idx + 1;
    await startRest(gi.exRestTime);
  };

  const handleCircuit_endRound = async (idx: number, gi: GroupInfo) => {
    const round = groupRoundRef.current[gi.groupId] ?? 1;
    saveDraftProgress(progress, elapsed);
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

  // SIMPLE GROUP — 1 round, per-exercise rest between exercises, no rest after last
  const handleSimple_continue = async (idx: number, gi: GroupInfo) => {
    saveDraftProgress(progress, elapsed);
    timedPhaseRef.current = 'idle';
    setTimedPhase('idle');
    postRestIdxRef.current = idx + 1;
    await startRest(gi.exRestTime);
  };

  const handleSimple_last = (_idx: number, gi: GroupInfo) => {
    advancePastGroup(gi);
  };

  const handleTimedAction = async () => {
    if (timedPhase === 'idle') {
      startTimedExercise();
      return;
    }
    if (timedPhase !== 'done') return;
    // Done: delegate to group or standalone action
    const gi = getGroupInfo(exercisesRef.current, activeIdx);
    if (gi) {
      handleGroupAction(gi);
    } else {
      const isLastSet = (progress[activeIdx]?.currentSet ?? 1) >= exercises[activeIdx]?.sets;
      if (isLastSet) handleProssimo();
      else           await handleRecupero();
    }
  };

  const handleGroupAction = async (gi: GroupInfo) => {
    if (gi.type === 'superset') {
      if (!gi.isLastInGroup) {
        handleSuperset_continue(activeIdx, gi);
      } else {
        await handleSuperset_endRound(activeIdx, gi);
      }
    } else if (gi.type === 'circuit') {
      if (!gi.isLastInGroup) {
        await handleCircuit_restNext(activeIdx, gi);
      } else {
        await handleCircuit_endRound(activeIdx, gi);
      }
    } else {
      // simple
      if (!gi.isLastInGroup) {
        await handleSimple_continue(activeIdx, gi);
      } else {
        handleSimple_last(activeIdx, gi);
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
  const effectiveSets = inGroup ? gi!.rounds : (currentEx?.sets ?? 1);
  const isLastSet   = inGroup ? (curRound >= gi!.rounds) : (currentProg.currentSet >= (currentEx?.sets ?? 1));
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
        if (inGroup) {
          if (gi!.type === 'superset' && !gi!.isLastInGroup) return 'Prosegui →';
          if (gi!.type === 'simple') {
            if (!gi!.isLastInGroup) return `Recupero (${gi!.exRestTime}s)`;
            return gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio';
          }
          if (isLastSet) return gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio';
          return gi!.type === 'superset' ? `Recupero (${gi!.restTime}s)` : `Fine giro ${curRound}/${gi!.rounds}`;
        }
        return isLastSet ? (activeIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio') : 'Recupero';
      }
    }
  };

  // ── Action button label & color ─────────────────────────────────────────────
  let actionLabel = '';
  let actionColor: string = COLORS.primary;
  let actionIcon  = 'arrow-right';

  if (inGroup) {
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
    } else if (gi!.type === 'circuit') {
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
    } else {
      // simple group
      if (!gi!.isLastInGroup) {
        actionLabel = `Recupero (${formatTime(gi!.exRestTime)})`;
        actionColor = COLORS.success;
        actionIcon  = 'stopwatch';
      } else {
        actionLabel = gi!.lastIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio';
        actionColor = COLORS.success;
        actionIcon  = gi!.lastIdx >= exercises.length - 1 ? 'trophy' : 'arrow-right';
      }
    }
  } else {
    // standalone
    if (isLastSet) {
      actionLabel = activeIdx >= exercises.length - 1 ? 'Fine allenamento' : 'Prossimo esercizio';
      actionColor = COLORS.success;
      actionIcon  = activeIdx >= exercises.length - 1 ? 'trophy' : 'arrow-right';
    } else {
      actionLabel = `Recupero (${currentEx?.rest_time}s)`;
      actionColor = COLORS.primary;
      actionIcon  = 'stopwatch';
    }
  }

  const handleMainAction = async () => {
    if (inGroup) {
      await handleGroupAction(gi!);
    } else if (isLastSet) {
      handleProssimo();
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
                            ? 'Esegui ogni esercizio in sequenza'
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
                              const isLastExerciseInGroup = e.id === exercises[exGi.lastIdx]?.id;
                              return (exGi.type === 'circuit' || (exGi.type === 'simple' && !isLastExerciseInGroup)) && (
                                <View style={styles.tag}>
                                  <FontAwesome5 name="stopwatch" size={9} color={COLORS.textMuted} solid />
                                  <Text style={styles.tagText}>{e.rest_time}s</Text>
                                </View>
                              );
                            })()}
                          </View>
                          {gActive && !gDone && started && (
                            <View style={styles.activeDetails}>
                              <Text style={[styles.setLabel, { color: typeColor }]}>
                                {exGi.type === 'simple' ? 'Serie unica' : `Giro ${curGrpRound} di ${exGi.rounds}`}
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
                                    value={gProg.weights[curGrpRound - 1] ?? ''}
                                    onChangeText={(v) => updateWeight(i, curGrpRound - 1, v)}
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
                              value={prog.weights[prog.currentSet - 1] ?? ''}
                              onChangeText={(v) => updateWeight(idx, prog.currentSet - 1, v)}
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
            style={[styles.actionBtn, { backgroundColor: actionColor }]}
            onPress={handleMainAction}
            activeOpacity={0.85}
          >
            <FontAwesome5 name={actionIcon} size={16} color={COLORS.white} solid />
            <Text style={styles.actionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmDialog
        visible={abandonDialog}
        title="Interrompere l'allenamento?"
        message={started ? 'Le serie completate andranno perse.' : 'Tornare alla selezione scheda?'}
        icon="stop-circle"
        confirmLabel={started ? 'Interrompi' : 'Esci'}
        cancelLabel="Continua"
        destructive
        onCancel={() => setAbandonDialog(false)}
        onConfirm={() => {
          setAbandonDialog(false);
          deleteDraft().catch(() => {});
          navigation.goBack();
        }}
      />
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
