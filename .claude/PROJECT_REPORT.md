# MyGymTracker — Project Report

**Versione:** 0.1 (bozza)
**Data:** 2026-04-29
**Piattaforma target:** Android
**Stack:** React Native + Expo

---

## 1. Idea di progetto

MyGymTracker è un'app mobile per la gestione completa degli allenamenti in palestra. L'obiettivo è coprire l'intero ciclo: creazione del piano di allenamento (eventualmente da parte di un personal trainer), esecuzione guidata della sessione con timer di recupero integrato, registrazione progressiva dei carichi, e consultazione dello storico nel tempo.

L'app è pensata per un singolo utente per dispositivo. Il personal trainer può usare la stessa app per creare piani da condividere con i propri clienti tramite un file esportabile.

---

## 2. Requisiti funzionali

### 2.1 Gestione piani di allenamento

- Creazione di uno o più **piani di allenamento** (es. "Ipertrofia 3 giorni", "Programma Forza").
- Ogni piano contiene più **schede** (es. "Giorno A – Push", "Giorno B – Pull", "Giorno C – Legs").
- Ogni scheda ha: nome, descrizione facoltativa, note facoltative, lista esercizi.
- Le schede si usano in rotazione libera (l'utente sceglie quale scheda eseguire ogni volta).
- Un piano può essere in stato **attivo** o **archiviato**.
- I piani archiviati restano consultabili ma non compaiono nella selezione allenamento.

### 2.2 Archivio esercizi

- Esiste un **database globale di esercizi**, condiviso tra tutti i piani.
- Gli esercizi sono selezionati da un menu a tendina ordinato alfabeticamente.
- È possibile aggiungere nuovi esercizi al database se non esistono.
- Ogni esercizio ha: nome (identificatore univoco).
- Futura espansione prevista: raggruppamento per gruppo muscolare.

### 2.3 Configurazione esercizi in una scheda

Per ogni esercizio inserito in una scheda si configurano:

| Campo | Valori |
|---|---|
| Serie | Da 1 a 7 (menu a tendina) |
| Ripetizioni | Da 1 a 20 (menu a tendina) |
| Tempo di recupero | Da 30s a 120s, passo 15s (menu a tendina) |
| Note esercizio | Testo libero facoltativo |

### 2.4 Schermata piani attivi

- Lista dei piani in stato attivo.
- Azione rapida per archiviare un piano.
- Accesso al dettaglio del piano (lista schede).

### 2.5 Avvio allenamento

- Se è attivo **un solo piano**: si passa direttamente alla scelta della scheda.
- Se sono attivi **più piani**: si sceglie prima il piano, poi la scheda.
- Un **tooltip** indica l'ultima scheda eseguita all'interno del piano selezionato.

### 2.6 Sessione di allenamento attiva

#### Layout

- **In alto:** cronometro che misura la durata totale della sessione (hh:mm:ss), visibile per tutta la durata.
- **Centro:** lista degli esercizi della scheda con, per ciascuno:
  - Nome esercizio
  - Serie × Ripetizioni × Recupero configurati
  - **Freccia sinistra** che indica l'esercizio corrente
  - **Riga peso per serie:** un campo di testo per ogni serie dell'esercizio. Il campo è precompilato con il peso usato l'ultima volta che quell'esercizio è stato eseguito con lo stesso numero di ripetizioni; se non ci sono dati precedenti, il campo è vuoto. Il valore persiste tra una serie e l'altra (l'utente cambia solo se necessario).
- **In basso:** pulsante azione.

#### Flusso serie / recupero

1. L'utente esegue la serie corrente.
2. Preme **"Recupero"** → parte un conto alla rovescia con la durata configurata per quell'esercizio.
3. Alla fine del timer scatta la notifica (suono e/o vibrazione, configurabile).
4. L'utente può avviare la serie successiva.
5. Questo ciclo si ripete per `N - 1` recuperi (se le serie sono 3, i recuperi sono 2).
6. Dopo l'ultima serie il pulsante diventa **"Prossimo"**: la freccia sinistra si trasforma in una **flag verde**, la freccia passa all'esercizio successivo.
7. Premendo "Prossimo" si passa direttamente all'esercizio successivo senza timer intermedio.
8. Al termine dell'ultimo esercizio appare la schermata di **riepilogo sessione**.

#### Timer in background

- Il conto alla rovescia continua anche se l'app è in background o lo schermo è spento.
- La notifica di fine recupero compare nel pannello notifiche Android.

### 2.7 Riepilogo fine allenamento

- Durata totale della sessione.
- Lista esercizi con i pesi registrati per ogni serie.
- Pulsante per salvare e chiudere la sessione.

### 2.8 Storico allenamenti

- Ogni sessione completata viene salvata con: data, piano, scheda, durata, pesi per serie.
- Lo storico è consultabile per piano, con filtri facoltativi per scheda e per singolo allenamento.
- Il piano diventa automaticamente il registro di tutte le sessioni eseguite.

### 2.9 Suggerimento pesi

- Il suggerimento viene dall'**ultima sessione** in cui quell'esercizio è stato eseguito.
- Il suggerimento è **vincolato al numero di ripetizioni**: se l'ultima volta era 3×8 con 80 kg e oggi si fa 4×8, il suggerimento è 80 kg. Se oggi si fa 3×12 o 4×6, il campo è vuoto (numero di reps diverso).

### 2.10 Export e import piani

- **Export piano:** genera un file `.workout` (formato JSON interno) contenente il piano con tutte le schede, gli esercizi e le configurazioni (senza i pesi, che sono dati personali dell'utente).
- **Import piano:** l'utente riceve un file `.workout` (es. via WhatsApp, email) e lo apre con l'app. L'app effettua un **merge** del database esercizi (aggiunge gli esercizi non presenti) e crea il piano pronto per il primo allenamento.
- Il PT può creare piani con la stessa app e condividerli con i clienti.

### 2.11 Export storico

- Filtri: per piano, per scheda (facoltativo), per singolo allenamento (facoltativo).
- Formati: **PDF** (leggibile), **CSV** (per Excel), o **entrambi**.

### 2.12 Impostazioni

- **Notifiche timer:** scelta tra suono, vibrazione, entrambi, nessuno.
- Possibili espansioni future: tema chiaro/scuro, lingua.

---

## 3. Requisiti non funzionali

- **Offline-first:** tutta l'app funziona senza connessione internet; i dati sono salvati localmente.
- **Singolo utente per dispositivo.**
- **Performance:** il timer deve essere preciso anche in background.
- **Persistenza:** i dati non devono essere persi in caso di chiusura forzata dell'app.

---

## 4. Strumenti e tecnologie

### 4.1 Già installati sul sistema

| Strumento | Versione | Ruolo |
|---|---|---|
| Node.js | 22.18.0 | Runtime JavaScript |
| npm | 10.9.3 | Gestore pacchetti |
| VS Code | ultima | Editor di codice |
| Git | 2.50.1 | Controllo versione |
| Python | 3.13.4 | Script di supporto |

### 4.2 Da installare

| Strumento | Comando | Ruolo |
|---|---|---|
| Expo CLI | `npm install -g expo-cli` | Framework React Native |
| Expo Go (telefono) | Play Store | Test live su dispositivo durante sviluppo |

### 4.3 Dipendenze principali del progetto

| Pacchetto | Scopo |
|---|---|
| `expo` | Base framework |
| `expo-sqlite` | Database locale SQLite |
| `expo-notifications` | Notifiche e timer in background |
| `expo-file-system` | Lettura/scrittura file `.workout` |
| `expo-sharing` | Condivisione file export |
| `expo-document-picker` | Selezione file import |
| `expo-print` | Generazione PDF per export storico |
| `react-navigation` | Navigazione tra schermate |
| `@react-native-async-storage/async-storage` | Salvataggio impostazioni |

### 4.4 Per la pubblicazione (futuro)

- **Android Studio** + **JDK 17** per generare l'APK / bundle da caricare su Play Store.
- Account Google Play Developer (25 USD una tantum).
- In alternativa: build cloud con **EAS Build** (servizio Expo, gratuito per uso personale).

---

## 5. Struttura del database

```
exercises
  id          INTEGER PRIMARY KEY
  name        TEXT UNIQUE NOT NULL

training_plans
  id          INTEGER PRIMARY KEY
  name        TEXT NOT NULL
  description TEXT
  status      TEXT DEFAULT 'active'   -- 'active' | 'archived'
  created_at  DATETIME

workout_cards
  id          INTEGER PRIMARY KEY
  plan_id     INTEGER REFERENCES training_plans(id)
  name        TEXT NOT NULL
  description TEXT
  notes       TEXT
  sort_order  INTEGER

card_exercises
  id          INTEGER PRIMARY KEY
  card_id     INTEGER REFERENCES workout_cards(id)
  exercise_id INTEGER REFERENCES exercises(id)
  sets        INTEGER    -- 1..7
  reps        INTEGER    -- 1..20
  rest_time   INTEGER    -- secondi: 30, 45, 60, 75, 90, 105, 120
  notes       TEXT
  sort_order  INTEGER

workout_sessions
  id          INTEGER PRIMARY KEY
  plan_id     INTEGER REFERENCES training_plans(id)
  card_id     INTEGER REFERENCES workout_cards(id)
  started_at  DATETIME
  ended_at    DATETIME
  duration_s  INTEGER    -- durata in secondi

session_sets
  id                INTEGER PRIMARY KEY
  session_id        INTEGER REFERENCES workout_sessions(id)
  card_exercise_id  INTEGER REFERENCES card_exercises(id)
  exercise_id       INTEGER REFERENCES exercises(id)
  set_number        INTEGER    -- 1, 2, 3...
  reps              INTEGER    -- reps effettive (= quelle configurate)
  weight            REAL       -- kg
  completed_at      DATETIME
```

---

## 6. Struttura delle schermate e navigazione

```
App
├── Tab: Piani
│   ├── PianiAttiviScreen          Lista piani attivi + azione archivia
│   ├── DettaglioPianoScreen       Schede del piano + storico sessioni
│   ├── CreaPianoScreen            Nuovo piano (nome, descrizione)
│   ├── CreaSchedaScreen           Nuova scheda (nome, descrizione, note)
│   └── AggiungiEsercizioScreen    Selezione da DB + config serie/reps/recupero
│
├── Tab: Allenamento
│   ├── SceltaPianoScreen          (solo se >1 piano attivo)
│   ├── SceltaSchedaScreen         Lista schede + tooltip ultima scheda
│   ├── AllenamentoAttivoScreen    Cronometro + lista esercizi + timer recupero
│   └── RiepilogoScreen            Riepilogo fine sessione + salvataggio
│
├── Tab: Storico
│   ├── StoricoScreen              Filtri (piano, scheda, sessione) + lista
│   └── EsportaScreen              Scelta formato (PDF / CSV / entrambi)
│
└── Tab: Impostazioni
    └── ImpostazioniScreen         Notifiche timer, import .workout
```

---

## 7. UX — Flusso principale

### 7.1 Prima configurazione

1. L'utente apre l'app → schermata **Piani** vuota con CTA "Crea il tuo primo piano".
2. Crea un piano → aggiunge schede → aggiunge esercizi selezionandoli dal menu (o creandone di nuovi).
3. Il piano è pronto.

### 7.2 Avvio allenamento tipico

```
Tab Allenamento
  → (se >1 piano attivo) Scegli piano
  → Scegli scheda  [tooltip: "Ultima eseguita: Giorno A – ieri"]
  → Parte AllenamentoAttivoScreen
      ┌─────────────────────────────────┐
      │  ⏱ 00:12:34                     │  ← cronometro in alto
      │                                 │
      │  → Squat                        │  ← freccia esercizio attivo
      │     3 serie × 8 reps × 90s      │
      │     S1: [80 kg]  S2: [80 kg]    │  ← campi peso (precompilati)
      │     S3: [  __ ]                 │
      │                                 │
      │    Panca Piana                  │
      │     4 serie × 10 reps × 60s     │
      │     S1..S4: [  __ ]             │
      │                                 │
      │  ┌─────────────────────────┐    │
      │  │        RECUPERO         │    │  ← pulsante primario
      │  └─────────────────────────┘    │
      └─────────────────────────────────┘

  Dopo aver premuto RECUPERO:
      → Conto alla rovescia (es. 1:30)
      → Notifica audio/vibrazione al termine
      → Pronto per la serie successiva

  Dopo l'ultima serie dell'esercizio:
      → Freccia diventa 🏁 (flag verde)
      → Pulsante diventa "PROSSIMO"
      → Tap → passa all'esercizio successivo

  Fine ultimo esercizio:
      → RiepilogoScreen
```

### 7.3 Import piano dal PT

1. Il PT esporta il piano → file `programma_forza.workout`.
2. Lo invia via WhatsApp/email al cliente.
3. Il cliente tocca il file → Android apre MyGymTracker.
4. L'app mostra: "Importare il piano 'Programma Forza'? Contiene 3 schede e 12 esercizi."
5. Conferma → merge DB esercizi + piano creato pronto all'uso.

### 7.4 Export storico

1. Tab Storico → "Esporta".
2. Filtri: piano (obbligatorio), scheda (opzionale), allenamento (opzionale).
3. Formato: PDF / CSV / Entrambi.
4. Condivisione via intent Android (WhatsApp, Drive, email, ecc.).

---

## 8. Processo di sviluppo

### Fase 1 — Setup e navigazione (Sprint 1)

- Inizializzazione progetto Expo.
- Configurazione navigazione a tab (react-navigation).
- Setup database SQLite con schema completo.
- Schermate vuote con struttura navigazione.

### Fase 2 — Creazione piani e schede (Sprint 2)

- CRUD piani di allenamento.
- CRUD schede.
- Database esercizi con menu a tendina + aggiunta nuovi esercizi.
- Configurazione esercizi (serie, reps, recupero).

### Fase 3 — Schermata allenamento (Sprint 3)

- Selezione piano/scheda con tooltip.
- AllenamentoAttivoScreen con cronometro.
- Gestione serie/recupero con timer in background.
- Campi peso con suggerimento automatico.
- Logica flag verde / prossimo esercizio.

### Fase 4 — Salvataggio e storico (Sprint 4)

- Salvataggio sessione a fine allenamento.
- RiepilogoScreen.
- Schermata storico con filtri.

### Fase 5 — Export/Import (Sprint 5)

- Export `.workout` (JSON).
- Import `.workout` con merge DB.
- Export storico (PDF + CSV).

### Fase 6 — Impostazioni e rifinitura (Sprint 6)

- Schermata impostazioni notifiche.
- Gestione piani archiviati.
- Test su dispositivo Android reale.
- Correzione bug e ottimizzazione UX.

---

## 9. Considerazioni future (fuori scope v1)

- Raggruppamento esercizi per gruppo muscolare.
- Grafici di progressione per singolo esercizio.
- Tema chiaro/scuro.
- Supporto iOS.
- Sincronizzazione cloud / backup.
- Profili multipli sullo stesso dispositivo.
- Notifiche promemoria allenamento.

---

## 10. Nome e identità

- **Nome provvisorio:** MyGymTracker
- Il nome è modificabile in qualsiasi momento aggiornando `app.json` prima della pubblicazione sullo store.
- Il `package name` interno (es. `com.mygymtracker`) deve essere definito prima della prima pubblicazione su Google Play e non è più modificabile in seguito.
