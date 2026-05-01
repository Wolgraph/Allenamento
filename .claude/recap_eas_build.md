# Recap — Generazione APK con EAS Build

## Contesto

Progetto React Native + Expo (MyGymTracker), uso personale, target Android.
Obiettivo: ottenere un APK installabile via sideload senza pubblicare su Play Store.

---

## Operazioni svolte

### 1. Installazione EAS CLI

```
npm install -g eas-cli
```

### 2. Login account Expo

```
eas login
```

### 3. Configurazione EAS nel progetto

```
eas build:configure
```

Il comando crea la struttura sul server Expo ma **non genera `eas.json` in locale**.
Il file va creato manualmente nella root del progetto.

### 4. Creazione manuale di `eas.json`

File creato nella root del progetto (stesso livello di `app.json` e `package.json`):

```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Senza `"buildType": "apk"` EAS produce un `.aab`, non installabile direttamente.

### 5. Avvio build

```
eas build -p android --profile preview
```

Durante il processo rispondere **yes** alla domanda "Generate a new Android Keystore?".
Expo genera e salva il Keystore sui propri server e lo riusa nelle build successive.

---

## Note

- L'avviso `cli.appVersionSource is not set` è ignorabile, non blocca la build.
- Il Keystore è la firma crittografica dell'app. Lasciarlo gestire a Expo evita problemi di perdita del file.
- Al termine della build EAS fornisce un link per scaricare l'APK.
- L'APK si installa sul telefono abilitando "Origini sconosciute" nelle impostazioni Android.
