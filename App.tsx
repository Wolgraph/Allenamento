import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import { parseWorkoutFile } from './src/utils/workoutFile';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const fb = getTimerFeedbackSync();
    return {
      shouldShowAlert:  false,
      shouldShowBanner: false,
      shouldShowList:   true,
      shouldPlaySound:  fb === 'sound' || fb === 'both',
      shouldSetBadge:   false,
    };
  },
});

import { initDatabase } from './src/database/db';
import { seedExercisesIfEmpty } from './src/database/exerciseRepository';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme/colors';
import { loadTimerFeedback, getTimerFeedbackSync } from './src/utils/settings';
import { readDraft, deleteDraft } from './src/utils/sessionDraft';

const navigationRef = createNavigationContainerRef();

/** Ritorna true se l'URL viene da un intent di apertura file (non un deep-link app). */
function isFileIntent(url: string): boolean {
  return url.startsWith('content://') || url.startsWith('file://');
}

export default function App() {
  const [ready,      setReady]      = useState(false);
  const [navReady,   setNavReady]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  // Processa un URI di file .workout e naviga alla schermata di importazione
  const processWorkoutUrl = useCallback(async (url: string) => {
    try {
      let readUri = url;
      if (url.startsWith('content://')) {
        const dest = (FileSystem.cacheDirectory ?? '') + 'import_tmp.workout';
        await FileSystem.copyAsync({ from: url, to: dest });
        readUri = dest;
      }
      const content     = await FileSystem.readAsStringAsync(readUri);
      const workoutData = parseWorkoutFile(content);
      navigationRef.dispatch(
        CommonActions.navigate('Piani', {
          screen: 'ImportScheda',
          params: { workoutData },
        })
      );
    } catch (e: any) {
      Alert.alert(
        'File non valido',
        e?.message ?? 'Il file .workout non può essere letto o è corrotto.'
      );
    }
  }, []);

  // Cattura l'URL iniziale (app aperta cold via intent) e gli URL successivi (app in background)
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url && isFileIntent(url)) pendingUrlRef.current = url;
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url || !isFileIntent(url)) return;
      if (navigationRef.isReady()) {
        processWorkoutUrl(url);
      } else {
        pendingUrlRef.current = url;
      }
    });
    return () => sub.remove();
  }, [processWorkoutUrl]);

  // Processa l'URL pending non appena sia il DB sia il navigator sono pronti
  useEffect(() => {
    if (ready && navReady && pendingUrlRef.current) {
      const url = pendingUrlRef.current;
      pendingUrlRef.current = null;
      processWorkoutUrl(url);
    }
  }, [ready, navReady, processWorkoutUrl]);

  // Controlla draft sessione interrotta al boot, indipendentemente dalla tab attiva
  useEffect(() => {
    if (!ready || !navReady) return;
    readDraft().then(draft => {
      if (!draft) return;
      Alert.alert(
        'Allenamento interrotto',
        `Trovato un allenamento non completato: "${draft.cardName}".\nVuoi riprendere?`,
        [
          {
            text: 'Annulla',
            style: 'destructive',
            onPress: () => deleteDraft().catch(() => {}),
          },
          {
            text: 'Riprendi',
            style: 'default',
            onPress: () => navigationRef.dispatch(
              CommonActions.navigate('Allenamento', {
                screen: 'AllenamentoAttivo',
                params: { cardId: draft.cardId, planId: draft.planId, cardName: draft.cardName },
              })
            ),
          },
        ],
        { cancelable: false }
      );
    });
  }, [ready, navReady]);

  useEffect(() => {
    (async () => {
      try {
        initDatabase();
        seedExercisesIfEmpty();
        await loadTimerFeedback();
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Errore inizializzazione DB:{'\n'}{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => setNavReady(true)}
        >
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
