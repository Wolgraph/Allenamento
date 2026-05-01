import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../theme/colors';
import type { RootTabParamList, PianiStackParamList, WorkoutStackParamList } from './types';

import PianiAttiviScreen      from '../screens/plans/PianiAttiviScreen';
import CreaPianoScreen         from '../screens/plans/CreaPianoScreen';
import DettaglioPianoScreen    from '../screens/plans/DettaglioPianoScreen';
import CreaSchedaScreen        from '../screens/plans/CreaSchedaScreen';
import DettaglioSchedaScreen   from '../screens/plans/DettaglioSchedaScreen';
import AggiungiEsercizioScreen from '../screens/plans/AggiungiEsercizioScreen';
import ImportSchedaScreen       from '../screens/plans/ImportSchedaScreen';
import SceltaSchedaScreen      from '../screens/workout/SceltaSchedaScreen';
import AllenamentoAttivoScreen from '../screens/workout/AllenamentoAttivoScreen';
import RiepilogoScreen         from '../screens/workout/RiepilogoScreen';
import StoricoScreen           from '../screens/history/StoricoScreen';
import ImpostazioniScreen      from '../screens/settings/ImpostazioniScreen';
import CatalogoScreen          from '../screens/catalog/CatalogoScreen';

const Tab          = createBottomTabNavigator<RootTabParamList>();
const Stack        = createNativeStackNavigator<PianiStackParamList>();
const WorkoutStack = createNativeStackNavigator<WorkoutStackParamList>();

const stackScreenOptions = {
  headerStyle:      { backgroundColor: COLORS.surface },
  headerTintColor:  COLORS.text,
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle:     { backgroundColor: COLORS.bg },
};

function PianiStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PianiAttivi"       component={PianiAttiviScreen}      options={{ title: 'I Miei Piani' }} />
      <Stack.Screen name="CreaPiano"         component={CreaPianoScreen}         options={({ route }) => ({ title: route.params?.pianoId ? 'Modifica Piano' : 'Nuovo Piano' })} />
      <Stack.Screen name="DettaglioPiano"    component={DettaglioPianoScreen}    options={{ title: 'Dettaglio Piano' }} />
      <Stack.Screen name="CreaScheda"        component={CreaSchedaScreen}        options={({ route }) => ({ title: route.params?.schedaId ? 'Modifica Scheda' : 'Nuova Scheda' })} />
      <Stack.Screen name="DettaglioScheda"   component={DettaglioSchedaScreen}   options={{ title: 'Dettaglio Scheda' }} />
      <Stack.Screen name="AggiungiEsercizio" component={AggiungiEsercizioScreen} options={({ route }) => ({ title: route.params?.cardExerciseId ? 'Modifica Esercizio' : 'Aggiungi Esercizio' })} />
      <Stack.Screen name="ImportScheda"      component={ImportSchedaScreen}       options={{ title: 'Importa Scheda' }} />
    </Stack.Navigator>
  );
}

function AllenamentoStack() {
  return (
    <WorkoutStack.Navigator screenOptions={stackScreenOptions}>
      <WorkoutStack.Screen name="SceltaScheda"      component={SceltaSchedaScreen}      options={{ title: 'Inizia allenamento' }} />
      <WorkoutStack.Screen name="AllenamentoAttivo" component={AllenamentoAttivoScreen} options={{ title: 'In corso', headerBackVisible: false }} />
      <WorkoutStack.Screen name="Riepilogo"         component={RiepilogoScreen}         options={{ title: 'Riepilogo', headerBackVisible: false }} />
    </WorkoutStack.Navigator>
  );
}

export default function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: insets.bottom + 4,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, marginTop: -2 },
      }}
    >
      <Tab.Screen
        name="Piani"
        component={PianiStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="clipboard-list" size={size - 2} color={color} solid />
          ),
        }}
      />
      <Tab.Screen
        name="Allenamento"
        component={AllenamentoStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="dumbbell" size={size - 2} color={color} solid />
          ),
        }}
      />
      <Tab.Screen
        name="Catalogo"
        component={CatalogoScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="book-open" size={size - 2} color={color} solid />
          ),
          headerShown: true,
          headerTitle: 'Catalogo Esercizi',
          headerStyle:      { backgroundColor: COLORS.surface },
          headerTintColor:  COLORS.text,
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />
      <Tab.Screen
        name="Storico"
        component={StoricoScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="chart-bar" size={size - 2} color={color} solid />
          ),
        }}
      />
      <Tab.Screen
        name="Impostazioni"
        component={ImpostazioniScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="cog" size={size - 2} color={color} solid />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
