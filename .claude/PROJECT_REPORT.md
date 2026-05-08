# MyGymTracker — Project Report

**Versione:** 0.2
**Data:** 2026-05-08
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
- Gli esercizi sono selezionabili tramite modal di ricerca con filtri per zona muscolare e testo libero.
- È possibile aggiungere nuovi esercizi al database se non esistono, specificando tipo, descrizione e tag.
- Ogni esercizio ha: nome (identificatore univoco), tipo default, descrizione facoltativa.
- Gli esercizi sono **categorizzati per zona muscolare** (tag di tipo `zone`) e **per muscolo specifico** (tag di tipo `muscle`), usati per filtrare la ricerca e raggruppare le liste in sezioni.
- Una schermata **Catalogo** dedicata permette di sfogliare, cercare e gestire l'intero archivio esercizi.

### 2.3 Configurazione esercizi in una scheda

Ogni esercizio inserito in una scheda ha un **tipo** che determina i campi disponibili:

| Tipo | Descrizione |
|---|---|
| `reps` | Esercizio classico con peso e ripetizioni |
| `time` | Esercizio a tempo (es. plank, tapis roulant) — si configura la durata in secondi |
| `bodyweight` | Corpo libero — si registrano le ripetizioni senza peso |

Per ogni esercizio si configurano:

| Campo | Tipo applicabile | Valori |
|---|---|---|
| Serie | tutti | Da 1 a 10 |
| Ripetizioni | `reps`, `bodyweight` | Da 1 a 30 |
| Durata | `time` | Da 10s a 3000s, passo 5s (accelera a 30s e 60s dopo tap ripetuti) |
| Tempo di recupero | tutti | Da 0s a 300s, passo 15s (accelera a 30s e 60s dopo tap ripetuti) |
| Note esercizio | tutti | Testo libero facoltativo |

### 2.3bis Gruppi esercizi

Gli esercizi in una scheda possono essere raggruppati in blocchi con logica condivisa:

| Tipo gruppo | Comportamento |
|---|---|
| **Superserie** | Esercizi eseguiti in sequenza senza recupero intermedio; recupero unico al termine di ogni giro |
| **Circuito** | Esercizi eseguiti in sequenza con recupero tra un esercizio e il successivo; recupero aggiuntivo al termine di ogni giro |
| **Gruppo semplice** | Esercizi eseguiti in sequenza con recupero tra l'uno e l'altro; 1 solo giro |

I gruppi hanno: numero di giri, tempo di recupero tra giri (superserie/circuito), tempo di recupero tra esercizi (circuito/gruppo semplice).

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

- **In alto:** cronometro (hh:mm:ss), nome scheda, contatore esercizi completati, pulsanti pausa e stop.
- **Centro:** lista esercizi della scheda. Gli esercizi standalone e i gruppi (superserie/circuito) sono visualizzati con stili distinti. Per ogni esercizio attivo:
  - Nome esercizio, badge tipo (serie/tempo/corpo libero), recupero configurato
  - **Indicatore esercizio corrente** (icona play) e **completato** (flag a scacchi)
  - **Campo peso** (tipo `reps`): precompilato con il peso dell'ultima sessione per lo stesso numero di reps; aggiornabile per ogni serie
  - **Timer visivo** (tipo `time`): pre-countdown da 5s, poi conto alla rovescia con barra di progresso
  - **Badge corpo libero** (tipo `bodyweight`): nessun campo peso
- **In basso:** pulsante azione contestuale.

#### Flusso serie / recupero (esercizi standalone)

1. L'utente esegue la serie corrente (inserisce il peso se tipo `reps`).
2. Preme **"Recupero (Xs)"** → parte il conto alla rovescia.
3. Alla fine del timer scatta la notifica (suono e/o vibrazione, configurabile); l'utente può anche saltare il recupero.
4. Ciclo per `N - 1` recuperi; all'ultima serie il pulsante diventa **"Prossimo esercizio"**.
5. Al termine dell'ultimo esercizio il pulsante diventa **"Fine allenamento"** → riepilogo sessione.

#### Flusso gruppi esercizi

- **Superserie:** ogni esercizio del gruppo mostra "Prosegui →" (nessun recupero); al termine dell'ultimo esercizio del giro parte il recupero tra giri.
- **Circuito:** recupero tra ogni esercizio all'interno del giro; recupero aggiuntivo tra giri.
- **Gruppo semplice:** recupero tra esercizi, un solo giro.
- Il contatore giro corrente / totale giri è visibile nell'intestazione del blocco gruppo.

#### Esercizi a tempo (tipo `time`)

1. Pulsante **"Inizia serie"** → pre-countdown di 5s con vibrazione.
2. Parte il conto alla rovescia con barra di progresso visiva.
3. Alla fine vibrazione/notifica → il pulsante mostra l'azione successiva (recupero o prossimo).

#### Pausa e abbandono

- Pulsante **Pausa** sospende cronometro e timer recupero.
- Pulsante **Stop** apre dialog di conferma; in caso di abbandono la sessione non viene salvata.

#### Persistenza anti-crash

- A ogni azione viene aggiornato un file JSON temporaneo (`session_draft.json`) con lo stato completo (pesi inseriti, serie corrente, giro gruppo, tempo trascorso).
- Se l'app viene chiusa forzatamente, alla riapertura viene proposto di **riprendere** o **annullare** la sessione interrotta.
- Il salvataggio nel database avviene in un unico passaggio solo al termine dell'allenamento; il file draft viene cancellato (con await) prima di navigare al riepilogo.

#### Timer in background

- Il conto alla rovescia continua anche se l'app è in background o lo schermo è spento.
- La notifica di fine recupero compare nel pannello notifiche Android.

### 2.7 Riepilogo fine allenamento

La sessione è già salvata nel database prima di navigare qui (tramite `bulkSaveAndFinalize` al termine dell'allenamento).

- **Header:** icona trofeo, titolo "Allenamento completato!".
- **Riga statistiche:** durata totale, numero totale di serie, volume totale (somma peso × reps degli esercizi non a tempo; omesso se zero).
- **Lista esercizi:** griglia di chip, uno per serie; ogni chip mostra il numero di serie (S1, S2…) e il peso in kg (tipo `reps`) oppure la durata in secondi (tipo `time`).
- **Pulsante "Chiudi":** torna alla schermata di selezione scheda.

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

- Integrato nella schermata Storico tramite pulsante **"CSV"** nella barra superiore.
- Filtro opzionale per piano (chip orizzontali); senza filtro attivo esporta tutte le sessioni.
- Formato: solo **CSV** (compatibile con Excel / Google Sheets), condiviso via intent Android.

### 2.12 Impostazioni

- **Feedback fine recupero:** scelta tra vibrazione, suono, vibrazione + suono, nessuno.
- **Import piano:** selezione file `.workout` (via DocumentPicker); gli esercizi non presenti vengono aggiunti al DB, poi si naviga alla schermata di conferma import.
- **Piani archiviati:** lista dei piani con stato `archived`; pulsante "Riattiva" li riporta tra i piani attivi.

---

## 3. Requisiti non funzionali

- **Offline-first:** tutta l'app funziona senza connessione internet; i dati sono salvati localmente.
- **Singolo utente per dispositivo.**
- **Performance:** il timer deve essere preciso anche in background.
- **Persistenza anti-crash:** a ogni azione viene aggiornato il file `session_draft.json`; alla successiva apertura l'app rileva il draft e propone di riprendere o annullare la sessione interrotta.
- **Affidabilità salvataggio:** il salvataggio nel DB avviene in un unico passaggio atomico al termine dell'allenamento (`bulkSaveAndFinalize`), eliminando la possibilità di voci duplicate o parziali.

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
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  name          TEXT UNIQUE NOT NULL
  default_type  TEXT DEFAULT 'reps'   -- 'reps' | 'time' | 'bodyweight'
  description   TEXT
  lang          TEXT DEFAULT 'it'

exercise_tags
  id    INTEGER PRIMARY KEY AUTOINCREMENT
  name  TEXT UNIQUE NOT NULL
  type  TEXT NOT NULL              -- 'zone' | 'muscle'

exercise_tag_map
  exercise_id  INTEGER REFERENCES exercises(id) ON DELETE CASCADE
  tag_id       INTEGER REFERENCES exercise_tags(id) ON DELETE CASCADE
  PRIMARY KEY (exercise_id, tag_id)

training_plans
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  name        TEXT NOT NULL
  description TEXT
  status      TEXT DEFAULT 'active'   -- 'active' | 'archived'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP

workout_cards
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  plan_id     INTEGER REFERENCES training_plans(id) ON DELETE CASCADE
  name        TEXT NOT NULL
  description TEXT
  notes       TEXT
  sort_order  INTEGER DEFAULT 0

card_tag_map
  card_id  INTEGER REFERENCES workout_cards(id) ON DELETE CASCADE
  tag_id   INTEGER REFERENCES exercise_tags(id) ON DELETE CASCADE
  PRIMARY KEY (card_id, tag_id)

exercise_groups
  id         INTEGER PRIMARY KEY AUTOINCREMENT
  card_id    INTEGER REFERENCES workout_cards(id) ON DELETE CASCADE
  type       TEXT DEFAULT 'superset'  -- 'superset' | 'circuit' | 'simple'
  name       TEXT
  rounds     INTEGER DEFAULT 3
  rest_time  INTEGER DEFAULT 90       -- recupero tra giri (s)
  sort_order INTEGER DEFAULT 0

card_exercises
  id             INTEGER PRIMARY KEY AUTOINCREMENT
  card_id        INTEGER REFERENCES workout_cards(id) ON DELETE CASCADE
  exercise_id    INTEGER REFERENCES exercises(id)
  sets           INTEGER               -- 1..10
  reps           INTEGER               -- 1..30
  rest_time      INTEGER               -- 0..300 s
  notes          TEXT
  sort_order     INTEGER DEFAULT 0
  exercise_type  TEXT DEFAULT 'reps'   -- 'reps' | 'time' | 'bodyweight'
  duration       INTEGER               -- durata in secondi (solo tipo 'time')
  group_id       INTEGER               -- FK → exercise_groups.id (NULL = standalone)

workout_sessions
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  plan_id     INTEGER REFERENCES training_plans(id)
  card_id     INTEGER REFERENCES workout_cards(id)
  started_at  DATETIME NOT NULL
  ended_at    DATETIME
  duration_s  INTEGER                  -- durata in secondi

session_sets
  id                INTEGER PRIMARY KEY AUTOINCREMENT
  session_id        INTEGER REFERENCES workout_sessions(id) ON DELETE CASCADE
  card_exercise_id  INTEGER REFERENCES card_exercises(id)
  exercise_id       INTEGER REFERENCES exercises(id)
  set_number        INTEGER NOT NULL
  reps              INTEGER NOT NULL   -- reps (tipo reps/bodyweight) o durata s (tipo time)
  weight            REAL               -- kg (NULL per bodyweight e time)
  completed_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  exercise_type     TEXT DEFAULT 'reps'
```

---

## 6. Struttura delle schermate e navigazione

```
App
├── Tab: Piani
│   ├── PianiAttiviScreen          Lista piani attivi + azione archivia
│   ├── DettaglioPianoScreen       Schede del piano + storico sessioni piano
│   ├── CreaPianoScreen            Nuovo piano (nome, descrizione)
│   ├── CreaSchedaScreen           Nuova scheda (nome, descrizione, note)
│   ├── DettaglioSchedaScreen      Lista esercizi della scheda + gestione gruppi
│   ├── AggiungiEsercizioScreen    Selezione esercizio + config tipo/serie/reps/recupero/gruppo
│   └── ImportSchedaScreen         Anteprima e conferma import file .workout
│
├── Tab: Allenamento
│   ├── SceltaSchedaScreen         Selezione piano (se >1) + selezione scheda + recupero draft
│   ├── AllenamentoAttivoScreen    Cronometro + lista esercizi + timer recupero + draft
│   └── RiepilogoScreen            Statistiche sessione + dettaglio serie per esercizio
│
├── Tab: Storico
│   └── StoricoScreen              Lista sessioni raggruppata per giorno + filtro piano + export CSV
│
├── Tab: Catalogo
│   └── CatalogoScreen             Elenco esercizi + ricerca testo + filtri tag zona/muscolo
│
└── Tab: Impostazioni
    └── ImpostazioniScreen         Feedback timer + import .workout + piani archiviati
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

1. Tab Storico → pulsante **"CSV"** nella barra superiore.
2. Filtro piano opzionale (chip orizzontali); senza filtro esporta tutto lo storico.
3. Formato: **CSV**, condiviso via intent Android (WhatsApp, Drive, email, ecc.).

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

- Grafici di progressione per singolo esercizio.
- Export storico in formato PDF.
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
