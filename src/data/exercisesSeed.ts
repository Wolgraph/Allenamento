export type SeedTag = { name: string; type: 'zone' | 'muscle' };
export type SeedExercise = {
  name: string;
  lang: string;
  default_type: 'reps' | 'time' | 'bodyweight';
  tags: string[];
  description: string;
};

export const SEED_TAGS: SeedTag[] = [
  { name: 'Petto',           type: 'zone'   },
  { name: 'Schiena',         type: 'zone'   },
  { name: 'Spalle',          type: 'zone'   },
  { name: 'Braccia',         type: 'zone'   },
  { name: 'Gambe',           type: 'zone'   },
  { name: 'Glutei',          type: 'zone'   },
  { name: 'Core',            type: 'zone'   },
  { name: 'Full Body',       type: 'zone'   },
  { name: 'Cardio',          type: 'zone'   },
  { name: 'Gran Pettorale',  type: 'muscle' },
  { name: 'Dorsali',         type: 'muscle' },
  { name: 'Trapezio',        type: 'muscle' },
  { name: 'Lombari',         type: 'muscle' },
  { name: 'Deltoidi',        type: 'muscle' },
  { name: 'Bicipiti',        type: 'muscle' },
  { name: 'Tricipiti',       type: 'muscle' },
  { name: 'Avambracci',      type: 'muscle' },
  { name: 'Quadricipiti',    type: 'muscle' },
  { name: 'Femorali',        type: 'muscle' },
  { name: 'Gluteo',          type: 'muscle' },
  { name: 'Polpacci',        type: 'muscle' },
  { name: 'Addominali',      type: 'muscle' },
];

export const SEED_EXERCISES: SeedExercise[] = [
  // ── PETTO ──────────────────────────────────────────────────────────────────
  {
    name: 'Panca Piana',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale', 'Tricipiti'],
    description: 'Distensioni su panca orizzontale con bilanciere. Esercizio base per il gran pettorale, coinvolge tricipiti e deltoidi anteriori come muscoli secondari.',
  },
  {
    name: 'Panca Inclinata',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale', 'Deltoidi'],
    description: 'Distensioni su panca inclinata (30-45°) con bilanciere. Enfatizza la parte alta del pettorale e i deltoidi anteriori.',
  },
  {
    name: 'Panca Declinata',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale', 'Tricipiti'],
    description: 'Distensioni su panca declinata con bilanciere. Enfatizza la parte bassa del gran pettorale.',
  },
  {
    name: 'Panca Piana con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale'],
    description: 'Distensioni su panca orizzontale con manubri. Maggior range di movimento rispetto al bilanciere, utile per sviluppare la forza stabilizzatrice.',
  },
  {
    name: 'Panca Inclinata con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale', 'Deltoidi'],
    description: 'Distensioni su panca inclinata con manubri. Parte alta del pettorale.',
  },
  {
    name: 'Chest Press',
    lang: 'en', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale', 'Tricipiti'],
    description: 'Distensioni su macchina per il petto. Movimento guidato, ideale per isolare il pettorale con minor rischio rispetto al bilanciere libero.',
  },
  {
    name: 'Croci su Panca',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale'],
    description: 'Aperture con manubri su panca orizzontale. Movimento di adduzione orizzontale per isolare il gran pettorale. Focus sullo stretch nella fase eccentrica.',
  },
  {
    name: 'Croci Inclinata',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale'],
    description: 'Aperture con manubri su panca inclinata. Enfatizza la parte alta del pettorale.',
  },
  {
    name: 'Croci ai Cavi',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale'],
    description: 'Aperture ai cavi incrociati. Tensione costante sul pettorale per tutto il range di movimento. Varianti: cavi alti (parte bassa), cavi medi (parte media), cavi bassi (parte alta).',
  },
  {
    name: 'Peck Deck',
    lang: 'en', default_type: 'reps',
    tags: ['Petto', 'Gran Pettorale'],
    description: 'Aperture alla macchina peck deck. Isolamento del gran pettorale con movimento guidato. Ottimo per il pump e il finisher.',
  },
  {
    name: 'Pullover con Manubrio',
    lang: 'it', default_type: 'reps',
    tags: ['Petto', 'Schiena', 'Gran Pettorale', 'Dorsali'],
    description: 'Disteso su panca, abbassamento del manubrio oltre la testa. Coinvolge gran pettorale e gran dorsale. Utile per l\'espansione della cassa toracica.',
  },
  {
    name: 'Push Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Petto', 'Gran Pettorale', 'Tricipiti'],
    description: 'Flessioni a terra. Esercizio classico a corpo libero per petto, tricipiti e deltoidi anteriori. Variare larghezza della presa per enfatizzare diversi fasci muscolari.',
  },
  {
    name: 'Push Up Declinato',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Petto', 'Gran Pettorale', 'Deltoidi'],
    description: 'Flessioni con piedi elevati. Maggior enfasi sulla parte alta del pettorale e sui deltoidi anteriori.',
  },
  {
    name: 'Dip',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Petto', 'Braccia', 'Gran Pettorale', 'Tricipiti'],
    description: 'Alle parallele con busto inclinato in avanti per enfatizzare il petto. Esercizio compound eccellente per petto basso e tricipiti.',
  },

  // ── SCHIENA ────────────────────────────────────────────────────────────────
  {
    name: 'Stacco da Terra',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Glutei', 'Gambe', 'Lombari', 'Gluteo', 'Femorali'],
    description: 'Sollevamento del bilanciere da terra. Esercizio compound fondamentale. Coinvolge catena posteriore completa: lombari, glutei, femorali, trapezio.',
  },
  {
    name: 'Stacco Rumeno',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Gambe', 'Glutei', 'Femorali', 'Gluteo', 'Lombari'],
    description: 'Variante dello stacco con ginocchia quasi estese. Enfatizza femorali e glutei attraverso lo stretch nella fase eccentrica. Mantenere schiena neutra.',
  },
  {
    name: 'Trazioni alla Sbarra',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Schiena', 'Braccia', 'Dorsali', 'Bicipiti'],
    description: 'Pull-up a presa pronata (larga o media). Principale esercizio per i dorsali a corpo libero. Presa supina = chin-up, maggior coinvolgimento dei bicipiti.',
  },
  {
    name: 'Lat Machine',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Braccia', 'Dorsali', 'Bicipiti'],
    description: 'Tirate al petto alla macchina lat machine. Variante guidata delle trazioni. Presa larga pronata per i dorsali, presa stretta supina per più bicipiti.',
  },
  {
    name: 'Lat Machine Presa Stretta',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Braccia', 'Dorsali', 'Bicipiti'],
    description: 'Tirate al petto con presa neutrale stretta. Maggior coinvolgimento del fascio inferiore dei dorsali e dei bicipiti.',
  },
  {
    name: 'Rematore con Bilanciere',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Dorsali', 'Trapezio', 'Bicipiti'],
    description: 'Rematore busto flesso in avanti con bilanciere. Esercizio compound fondamentale per dorsali e trapezio. Tirare il bilanciere verso l\'ombelico mantenendo la schiena neutra.',
  },
  {
    name: 'Rematore con Manubrio',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Dorsali', 'Bicipiti'],
    description: 'Rematore unilaterale con manubrio su panca. Permette maggior range di movimento e correggere squilibri laterali.',
  },
  {
    name: 'Rematore al Cavo Basso',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Dorsali', 'Bicipiti'],
    description: 'Rematore seduto al cavo basso. Tensione costante sui dorsali. Variare l\'impugnatura (larga, stretta, neutra) per diversi stimoli.',
  },
  {
    name: 'T-Bar Row',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Dorsali', 'Trapezio'],
    description: 'Rematore con bilanciere a T. Ottimo per spessore della schiena. Presa stretta per più dorsali, presa larga per più trapezio medio.',
  },
  {
    name: 'Chest Supported Row',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Dorsali', 'Trapezio'],
    description: 'Rematore con petto appoggiato su panca inclinata. Elimina il compenso lombare, isolamento puro di dorsali e trapezio.',
  },
  {
    name: 'Scrollate con Bilanciere',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Spalle', 'Trapezio'],
    description: 'Alzata delle spalle con bilanciere (shrug). Isolamento del trapezio superiore. Movimento verticale puro, senza rotazione delle spalle.',
  },
  {
    name: 'Scrollate con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Spalle', 'Trapezio'],
    description: 'Alzata delle spalle con manubri (shrug). Maggior libertà di movimento rispetto al bilanciere.',
  },
  {
    name: 'Face Pull',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Spalle', 'Deltoidi', 'Trapezio'],
    description: 'Tirate al volto al cavo alto con corda. Fondamentale per la salute della spalla: rinforza i rotatori esterni e il deltoide posteriore. Essenziale nel programma di qualsiasi atleta.',
  },
  {
    name: 'Iperestensioni',
    lang: 'it', default_type: 'reps',
    tags: ['Schiena', 'Glutei', 'Lombari', 'Gluteo'],
    description: 'Estensioni del busto al roman chair. Rinforzo dei lombari e dei glutei. Eseguire lentamente, non iperestendere oltre la posizione neutra.',
  },
  {
    name: 'Good Morning',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Gambe', 'Lombari', 'Femorali'],
    description: 'Inclinazione del busto in avanti con bilanciere sulle spalle. Esercizio tecnico per rinforzare lombari e femorali. Richiede attenzione alla posizione della schiena.',
  },
  {
    name: 'Superman',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Schiena', 'Lombari'],
    description: 'A terra prono, estendere contemporaneamente braccia e gambe. Attivazione e rinforzo dei lombari. Ottimo come warm-up o esercizio accessorio.',
  },
  {
    name: 'Sumo Deadlift',
    lang: 'en', default_type: 'reps',
    tags: ['Schiena', 'Gambe', 'Glutei', 'Femorali', 'Gluteo', 'Quadricipiti'],
    description: 'Variante dello stacco con posizione larga dei piedi e punta dei piedi verso l\'esterno. Maggior coinvolgimento degli adduttori e dei glutei rispetto allo stacco classico.',
  },

  // ── SPALLE ─────────────────────────────────────────────────────────────────
  {
    name: 'Lento Avanti con Bilanciere',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Braccia', 'Deltoidi', 'Tricipiti'],
    description: 'Distensioni sopra la testa con bilanciere (Overhead Press). Esercizio compound fondamentale per le spalle. Eseguire in piedi per maggior attivazione del core.',
  },
  {
    name: 'Lento Avanti con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Braccia', 'Deltoidi', 'Tricipiti'],
    description: 'Distensioni sopra la testa con manubri. Maggior range di movimento e lavoro stabilizzatore rispetto al bilanciere.',
  },
  {
    name: 'Arnold Press',
    lang: 'en', default_type: 'reps',
    tags: ['Spalle', 'Deltoidi'],
    description: 'Variante dello shoulder press con manubri inventata da Arnold Schwarzenegger. La rotazione delle mani durante il movimento coinvolge tutti e tre i fasci del deltoide.',
  },
  {
    name: 'Alzate Laterali',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Deltoidi'],
    description: 'Aperture laterali con manubri. Isolamento del deltoide medio. Fondamentale per la larghezza delle spalle. Leggera flessione del gomito, non salire oltre i 90°.',
  },
  {
    name: 'Alzate Laterali ai Cavi',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Deltoidi'],
    description: 'Aperture laterali al cavo basso. Tensione costante sul deltoide medio per tutto il movimento, a differenza dei manubri.',
  },
  {
    name: 'Alzate Frontali',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Deltoidi'],
    description: 'Alzate frontali con manubri o disco. Isolamento del deltoide anteriore. Spesso già ben stimolato dalla panca, usare con cautela nel volume totale.',
  },
  {
    name: 'Alzate Posteriori',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Schiena', 'Deltoidi', 'Trapezio'],
    description: 'Aperture posteriori con manubri busto flesso o su panca inclinata. Deltoide posteriore e trapezio medio. Spesso trascurate ma fondamentali per la salute della spalla.',
  },
  {
    name: 'Tirate al Mento',
    lang: 'it', default_type: 'reps',
    tags: ['Spalle', 'Schiena', 'Deltoidi', 'Trapezio'],
    description: 'Upright row con bilanciere o manubri. Deltoide medio e trapezio. Attenzione: presa troppo stretta può impingere la spalla. Preferire presa larga.',
  },
  {
    name: 'Shoulder Press Machine',
    lang: 'en', default_type: 'reps',
    tags: ['Spalle', 'Deltoidi', 'Tricipiti'],
    description: 'Distensioni sopra la testa alla macchina. Movimento guidato, ideale per chi ha problemi di mobilità o per lavorare a cedimento in sicurezza.',
  },
  {
    name: 'Handstand Push Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Spalle', 'Braccia', 'Deltoidi', 'Tricipiti'],
    description: 'Flessioni in verticale sulla testa. Esercizio avanzato a corpo libero per spalle e tricipiti. Richiede forza e controllo significativi.',
  },

  // ── BICIPITI ───────────────────────────────────────────────────────────────
  {
    name: 'Curl con Bilanciere',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Flessione del gomito con bilanciere dritto o EZ. Esercizio base per i bicipiti. Il bilanciere EZ riduce lo stress sul polso rispetto al dritto.',
  },
  {
    name: 'Curl con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Curl alternato o simultaneo con manubri. Permette la supinazione del polso durante il movimento per massimizzare la contrazione dei bicipiti.',
  },
  {
    name: 'Curl a Martello',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti', 'Avambracci'],
    description: 'Curl con presa neutra (pollici verso l\'alto). Coinvolge il brachioradiale e il brachiale oltre ai bicipiti. Utile per spessore del braccio.',
  },
  {
    name: 'Curl ai Cavi',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Flessione del gomito al cavo basso. Tensione costante sui bicipiti. Ottimo per il pump e per il lavoro di isolamento.',
  },
  {
    name: 'Curl alla Panca Scott',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Curl con supporto per i gomiti sulla panca Scott (preacher curl). Elimina il compenso della spalla, isolamento puro dei bicipiti. Ottimo per il picco.',
  },
  {
    name: 'Curl di Concentrazione',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Curl unilaterale seduto con gomito appoggiato alla coscia. Massimo isolamento del bicipite. Eseguire lentamente con focus sulla contrazione.',
  },
  {
    name: 'Curl Inverso',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Avambracci', 'Bicipiti'],
    description: 'Curl con presa pronata. Enfatizza il brachioradiale e gli estensori del polso. Spesso trascurato ma importante per avambracci completi.',
  },
  {
    name: 'Curl Inclinato',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Bicipiti'],
    description: 'Curl con manubri su panca inclinata. La posizione inclina il braccio dietro il busto, aumentando lo stretch sul capo lungo dei bicipiti.',
  },
  {
    name: 'Chin Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Braccia', 'Schiena', 'Bicipiti', 'Dorsali'],
    description: 'Trazioni alla sbarra con presa supina stretta. Maggior coinvolgimento dei bicipiti rispetto alle trazioni a presa larga. Esercizio fondamentale.',
  },

  // ── TRICIPITI ──────────────────────────────────────────────────────────────
  {
    name: 'French Press',
    lang: 'en', default_type: 'reps',
    tags: ['Braccia', 'Tricipiti'],
    description: 'Estensioni sopra la testa con bilanciere EZ su panca (skull crusher / triceps extension). Coinvolge il capo lungo dei tricipiti con ottimo stretch. Attenzione alla posizione dei gomiti.',
  },
  {
    name: 'Skull Crusher',
    lang: 'en', default_type: 'reps',
    tags: ['Braccia', 'Tricipiti'],
    description: 'Estensioni con bilanciere EZ portando il bilanciere verso la fronte. Variante del French Press con maggior enfasi sui capi laterale e mediale dei tricipiti.',
  },
  {
    name: 'Pushdown ai Cavi',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Tricipiti'],
    description: 'Estensioni al cavo alto con barra dritta, V-bar o corda. Esercizio di isolamento per i tricipiti. La corda permette la pronazione finale per maggior contrazione.',
  },
  {
    name: 'Estensioni Tricipiti sopra la Testa',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Tricipiti'],
    description: 'Overhead triceps extension con manubrio o cavo. Massimo stretch del capo lungo dei tricipiti. Mantenere i gomiti fermi durante il movimento.',
  },
  {
    name: 'Kickback Tricipiti',
    lang: 'it', default_type: 'reps',
    tags: ['Braccia', 'Tricipiti'],
    description: 'Estensioni del gomito busto flesso con manubrio. Isolamento dei tricipiti. Efficace a peso leggero con contrazione isometrica al top.',
  },
  {
    name: 'Parallele',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Braccia', 'Petto', 'Tricipiti', 'Gran Pettorale'],
    description: 'Dip alle parallele con busto verticale. Enfasi sui tricipiti. Inclinando il busto in avanti si sposta il carico sul petto. Aggiungere peso con la cintura per la progressione.',
  },
  {
    name: 'Diamond Push Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Braccia', 'Petto', 'Tricipiti'],
    description: 'Flessioni con le mani a formare un triangolo sotto il petto. Isolamento dei tricipiti a corpo libero.',
  },

  // ── AVAMBRACCI ─────────────────────────────────────────────────────────────
  {
    name: 'Wrist Curl',
    lang: 'en', default_type: 'reps',
    tags: ['Braccia', 'Avambracci'],
    description: 'Flessione del polso con bilanciere o manubri, avambracci appoggiati su panca. Rinforza i flessori del polso.',
  },
  {
    name: 'Reverse Wrist Curl',
    lang: 'en', default_type: 'reps',
    tags: ['Braccia', 'Avambracci'],
    description: 'Estensione del polso con bilanciere o manubri. Rinforza gli estensori del polso e il brachioradiale.',
  },
  {
    name: "Farmer's Walk",
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Braccia', 'Avambracci'],
    description: 'Camminata con carichi pesanti in mano. Sviluppa grip strength, trapezio, core e resistenza generale. Essenziale nel functional training.',
  },

  // ── QUADRICIPITI ───────────────────────────────────────────────────────────
  {
    name: 'Squat con Bilanciere',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo'],
    description: 'Squat con bilanciere sulle spalle (back squat). Re degli esercizi per le gambe. Coinvolge quadricipiti, glutei, femorali e core. High bar vs low bar cambia la distribuzione del carico.',
  },
  {
    name: 'Squat Frontale',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Quadricipiti'],
    description: 'Squat con bilanciere tenuto davanti alle spalle. Maggior enfasi sui quadricipiti e sul core rispetto al back squat. Richiede buona mobilità del polso e delle caviglie.',
  },
  {
    name: 'Squat con Manubri',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti'],
    description: 'Squat con manubri tenuti ai lati. Variante accessibile per chi non ha ancora padronanza del bilanciere o lavora su alto rep.',
  },
  {
    name: 'Leg Press',
    lang: 'en', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo'],
    description: 'Distensioni delle gambe alla macchina leg press. Posizione alta dei piedi = più glutei/femorali. Posizione bassa = più quadricipiti. Sicuro e caricabile molto.',
  },
  {
    name: 'Leg Extension',
    lang: 'en', default_type: 'reps',
    tags: ['Gambe', 'Quadricipiti'],
    description: 'Estensioni del ginocchio alla macchina. Isolamento del quadricipite. Attenzione: pressione sul legamento crociato anteriore nei gradi finali di estensione. Usare range parziale se necessario.',
  },
  {
    name: 'Affondi',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo'],
    description: 'Lunges statici o alternati. Esercizio unilaterale per gambe e glutei. Ideale per correggere asimmetrie. Passo lungo = più glutei, passo corto = più quadricipiti.',
  },
  {
    name: 'Affondi in Cammino',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo'],
    description: 'Affondi in progressione avanzando. Aggiunge un componente dinamico e di equilibrio rispetto agli affondi statici.',
  },
  {
    name: 'Bulgarian Split Squat',
    lang: 'en', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo', 'Femorali'],
    description: 'Squat monopodalico con piede posteriore elevato su panca. Uno degli esercizi unilaterali più efficaci per quadricipiti e glutei. Alta intensità muscolare per gamba.',
  },
  {
    name: 'Hack Squat',
    lang: 'en', default_type: 'reps',
    tags: ['Gambe', 'Quadricipiti'],
    description: 'Squat alla macchina hack squat. Ottimo per isolare i quadricipiti con minor stress sulla schiena rispetto al back squat. Piedi bassi e vicini = più quadricipiti.',
  },
  {
    name: 'Step Up',
    lang: 'en', default_type: 'reps',
    tags: ['Gambe', 'Glutei', 'Quadricipiti', 'Gluteo'],
    description: 'Salita su box o panca con manubri o bilanciere. Esercizio funzionale unilaterale per gambe e glutei. Altezza del box regola il coinvolgimento dei glutei.',
  },
  {
    name: 'Wall Sit',
    lang: 'en', default_type: 'time',
    tags: ['Gambe', 'Quadricipiti'],
    description: 'Isometrica seduti con schiena al muro e ginocchia a 90°. Resistenza muscolare dei quadricipiti. Ottimo finisher o esercizio di attivazione.',
  },

  // ── FEMORALI ───────────────────────────────────────────────────────────────
  {
    name: 'Leg Curl Sdraiato',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Femorali'],
    description: 'Flessione del ginocchio alla macchina in posizione prona. Isolamento dei femorali. La posizione sdraiata allunga il capo lungo del bicipite femorale.',
  },
  {
    name: 'Leg Curl Seduto',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Femorali'],
    description: 'Flessione del ginocchio alla macchina in posizione seduta. I femorali lavorano in posizione di maggior accorciamento. Utile come variante.',
  },
  {
    name: 'Nordic Curl',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Gambe', 'Femorali'],
    description: 'Con piedi bloccati, abbassarsi lentamente verso il suolo solo con la forza dei femorali. Uno degli esercizi più efficaci per la prevenzione degli infortuni ai femorali.',
  },
  {
    name: 'Glute-Ham Raise',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Gambe', 'Glutei', 'Femorali', 'Gluteo'],
    description: 'Estensione del busto e flessione del ginocchio simultanee sulla panca GHR. Esercizio avanzato per femorali e glutei a corpo libero.',
  },

  // ── GLUTEI ─────────────────────────────────────────────────────────────────
  {
    name: 'Hip Thrust',
    lang: 'en', default_type: 'reps',
    tags: ['Glutei', 'Gambe', 'Gluteo', 'Femorali'],
    description: 'Estensione dell\'anca con spalle su panca e bilanciere (o manubrio) sul bacino. L\'esercizio più efficace per l\'ipertrofia del gluteo. Spingere il bacino verso il soffitto contraendo i glutei al top.',
  },
  {
    name: 'Ponte Glutei',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Glutei', 'Gluteo', 'Femorali'],
    description: 'Estensione dell\'anca a terra con spalle sul pavimento. Versione a corpo libero dell\'hip thrust. Ottimo per attivazione e riscaldamento dei glutei.',
  },
  {
    name: 'Kick Back Glutei',
    lang: 'it', default_type: 'reps',
    tags: ['Glutei', 'Gluteo'],
    description: 'Estensione dell\'anca al cavo basso o con elastico in quadrupedia. Isolamento del gluteo. Mantenere il core stabile ed evitare la rotazione del bacino.',
  },
  {
    name: 'Abductor Machine',
    lang: 'en', default_type: 'reps',
    tags: ['Glutei', 'Gambe', 'Gluteo'],
    description: 'Abduzione delle gambe alla macchina. Rinforza il gluteo medio e gli abduttori dell\'anca. Importante per la stabilità del ginocchio e la postura.',
  },
  {
    name: 'Sumo Squat',
    lang: 'en', default_type: 'reps',
    tags: ['Glutei', 'Gambe', 'Quadricipiti', 'Gluteo'],
    description: 'Squat con postura larga e punte verso l\'esterno. Maggior coinvolgimento degli adduttori e del gluteo rispetto allo squat standard.',
  },
  {
    name: 'Cable Kick Back',
    lang: 'en', default_type: 'reps',
    tags: ['Glutei', 'Gluteo'],
    description: 'Estensione dell\'anca al cavo basso con cavigliera. Ottimo per l\'isolamento del gluteo. Mantenere la schiena neutra e non oscillare.',
  },

  // ── POLPACCI ───────────────────────────────────────────────────────────────
  {
    name: 'Calf Raise in Piedi',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Polpacci'],
    description: 'Plantar flessione in piedi su gradino o piano. Lavora principalmente il gastrocnemio. Alto rep con buon range di movimento per sviluppare i polpacci.',
  },
  {
    name: 'Calf Raise Seduto',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Polpacci'],
    description: 'Plantar flessione seduto alla macchina. Con ginocchio flesso il gastrocnemio è in accorciamento, il lavoro si sposta sul soleo. Complementare al calf raise in piedi.',
  },
  {
    name: 'Calf Raise al Leg Press',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Polpacci'],
    description: 'Plantar flessione alla leg press con solo le punte dei piedi sulla piattaforma. Permette di usare carichi molto elevati in sicurezza.',
  },
  {
    name: 'Calf Raise Unilaterale',
    lang: 'it', default_type: 'reps',
    tags: ['Gambe', 'Polpacci'],
    description: 'Plantar flessione su un solo piede. Corregge asimmetrie e raddoppia l\'intensità per gamba. Eseguire su gradino per massimo range.',
  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  {
    name: 'Crunch',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Flessione del rachide lombare da sdraiato. Isola la parte superiore degli addominali. Non confondere con il sit-up: il lombare rimane a terra.',
  },
  {
    name: 'Crunch Inverso',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Da sdraiato, portare le ginocchia verso il petto flettendo il bacino. Enfatizza la parte bassa degli addominali.',
  },
  {
    name: 'Crunch al Cavo',
    lang: 'it', default_type: 'reps',
    tags: ['Core', 'Addominali'],
    description: 'Flessione del busto al cavo alto con corda, in ginocchio. Permette di caricare progressivamente gli addominali. Più efficiente del crunch a corpo libero per ipertrofia.',
  },
  {
    name: 'Plank',
    lang: 'en', default_type: 'time',
    tags: ['Core', 'Addominali', 'Lombari'],
    description: 'Isometrica in posizione di flessione con avambracci a terra. Rinforza tutto il core: retto dell\'addome, trasverso, obliqui e lombari. Mantenere corpo rigido come una tavola.',
  },
  {
    name: 'Plank Laterale',
    lang: 'it', default_type: 'time',
    tags: ['Core', 'Addominali'],
    description: 'Isometrica laterale su avambraccio. Isola gli obliqui e il quadrato dei lombi. Fondamentale per la stabilità laterale del core.',
  },
  {
    name: 'Russian Twist',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Rotazione del busto da seduto con piedi sollevati. Lavora gli obliqui. Aggiungere un disco o una palla medica per aumentare il carico.',
  },
  {
    name: 'Leg Raise',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Alzate delle gambe da sdraiato o alle parallele. Enfatizza la parte bassa degli addominali e gli flessori dell\'anca. Mantenere la zona lombare aderente al pavimento.',
  },
  {
    name: 'Alzate Gambe alle Sbarre',
    lang: 'it', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Alzate delle gambe appesi alla sbarra. Versione avanzata del leg raise. Maggior range di movimento e coinvolgimento del core per la stabilizzazione.',
  },
  {
    name: 'Ab Wheel',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali', 'Lombari'],
    description: 'Estensioni del busto con la ruota addominale. Uno degli esercizi più efficaci per il core. Iniziare dall\'inginocchiato e progredire verso il rollout completo.',
  },
  {
    name: 'Mountain Climber',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Cardio', 'Addominali'],
    description: 'In posizione di push-up, alternare le ginocchia verso il petto. Lavora il core in modo dinamico con un componente cardiovascolare significativo.',
  },
  {
    name: 'Dead Bug',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali', 'Lombari'],
    description: 'Da sdraiato, estendere alternatamente braccio e gamba opposta mantenendo la zona lombare a terra. Esercizio di controllo motorio eccellente per il core profondo.',
  },
  {
    name: 'Hollow Body Hold',
    lang: 'en', default_type: 'time',
    tags: ['Core', 'Addominali'],
    description: 'Posizione isometrica con schiena piatta a terra, braccia e gambe sollevate. Fondamentale nella ginnastica, ottimo per l\'attivazione del core profondo.',
  },
  {
    name: 'Bicycle Crunch',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Crunch con rotazione alternata gomito-ginocchio opposto. Coinvolge retto dell\'addome e obliqui simultaneamente.',
  },
  {
    name: 'Sit Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Flessione completa del busto da sdraiato a seduto. Coinvolge tutto il retto dell\'addome e gli flessori dell\'anca. Più completo del crunch ma con maggior stress sulla colonna.',
  },
  {
    name: 'Toes to Bar',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Appesi alla sbarra, portare i piedi a toccare la barra. Versione avanzata del leg raise che richiede forza e coordinazione significative.',
  },
  {
    name: 'Pallof Press',
    lang: 'en', default_type: 'reps',
    tags: ['Core', 'Addominali'],
    description: 'Distensioni anti-rotazione al cavo laterale. Esercizio fondamentale per la stabilità del core contro le forze rotazionali. Essenziale per la prevenzione degli infortuni lombari.',
  },
  {
    name: 'Bird Dog',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Schiena', 'Addominali', 'Lombari'],
    description: 'Da quadrupedia, estendere simultaneamente il braccio opposto alla gamba, mantenendo la schiena neutra e il bacino stabile. Attiva il core profondo (trasverso e multifido) senza caricare la colonna. Fondamentale per il controllo motorio e la prevenzione lombare. Ideale come riscaldamento o esercizio accessorio.',
  },
  {
    name: 'Hanging Knee Raise',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Appesi alla sbarra, portare le ginocchia verso il petto flettendo il bacino. Regressione del Leg Raise a gambe tese e del Toes to Bar. Prima progressione da padroneggiare prima di passare agli esercizi appesi avanzati. Mantenere la contrazione addominale al top del movimento.',
  },
  {
    name: 'Woodchop ai Cavi',
    lang: 'it', default_type: 'reps',
    tags: ['Core', 'Addominali'],
    description: 'Rotazione diagonale del busto contro resistenza al cavo. Versione dall\'alto verso il basso (cavo alto → anca opposta) o dal basso verso l\'alto (cavo basso → spalla opposta). Esercizio fondamentale per la forza rotazionale del core e degli obliqui. Funzionale per gli sport e i movimenti di spinta/rotazione.',
  },
  {
    name: 'V-Up',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Da sdraiato con braccia estese sopra la testa, sollevare simultaneamente gambe tese e busto portando le mani verso i piedi. Coinvolge l\'intero retto dell\'addome e gli flessori dell\'anca. Progressione naturale tra Crunch/Leg Raise e gli esercizi più avanzati di ginnastica.',
  },
  {
    name: 'Flutter Kick',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Core', 'Addominali'],
    description: 'Da sdraiato, alternare calci veloci con gambe tese a pochi centimetri dal suolo. Lavora il retto inferiore dell\'addome e, in modo significativo, l\'ileopsoas in contrazione isometrica prolungata. Utile per la resistenza muscolare del core e per rafforzare i flessori dell\'anca, spesso deboli in chi passa molte ore seduto.',
  },

  // ── FULL BODY / CARDIO ─────────────────────────────────────────────────────
  {
    name: 'Burpee',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Full Body', 'Cardio'],
    description: 'Sequenza: in piedi → squat → plank → push-up → squat → salto. Esercizio ad alta intensità che coinvolge tutto il corpo. Altissimo dispendio calorico.',
  },
  {
    name: 'Kettlebell Swing',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Glutei', 'Schiena', 'Gluteo', 'Femorali', 'Lombari'],
    description: 'Oscillazione del kettlebell con estensione esplosiva dell\'anca. Potenza della catena posteriore, condizionamento cardiovascolare. Non è uno squat: il drive viene dall\'anca, non dalle ginocchia.',
  },
  {
    name: 'Turkish Get Up',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Core', 'Spalle', 'Addominali'],
    description: 'Sequenza complessa da sdraiato a in piedi con kettlebell sopra la testa. Sviluppa mobilità, stabilità della spalla, forza del core. Eseguire lentamente e con controllo.',
  },
  {
    name: 'Box Jump',
    lang: 'en', default_type: 'bodyweight',
    tags: ['Full Body', 'Gambe', 'Quadricipiti', 'Gluteo'],
    description: 'Salto esplosivo su una box. Sviluppa potenza degli arti inferiori. Atterrare morbidamente con ginocchia flesse per ammortizzare l\'impatto.',
  },
  {
    name: 'Salto con la Corda',
    lang: 'it', default_type: 'time',
    tags: ['Cardio', 'Full Body'],
    description: 'Salto con la corda. Ottimo per il condizionamento cardiovascolare, coordinazione e resistenza dei polpacci. Varianti: singolo, doppio, alternato.',
  },
  {
    name: 'Battle Rope',
    lang: 'en', default_type: 'time',
    tags: ['Cardio', 'Full Body', 'Braccia'],
    description: 'Ondate alternate o simultanee con le corde da battaglia. Cardio ad alta intensità con forte coinvolgimento di braccia, spalle e core.',
  },
  {
    name: 'Sled Push',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Gambe', 'Cardio', 'Quadricipiti', 'Gluteo'],
    description: 'Spinta del carrello con carico. Eccellente per la potenza delle gambe e il condizionamento. Nessuna fase eccentrica = meno dolori muscolari il giorno dopo.',
  },
  {
    name: 'Power Clean',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Schiena', 'Gambe'],
    description: 'Sollevamento esplosivo del bilanciere da terra fino alle spalle. Movimento olimpico che sviluppa potenza esplosiva di tutta la catena posteriore. Richiede tecnica.',
  },
  {
    name: 'Clean and Jerk',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Schiena', 'Gambe', 'Spalle'],
    description: 'Sollevamento olimpico completo: clean + jerk. Il movimento più tecnico del weightlifting. Potenza esplosiva totale. Da eseguire solo con adeguata preparazione tecnica.',
  },
  {
    name: 'Snatch',
    lang: 'en', default_type: 'reps',
    tags: ['Full Body', 'Schiena', 'Spalle'],
    description: 'Sollevamento olimpico in un unico tempo dal suolo sopra la testa. Il movimento più tecnico e atletico del weightlifting. Massima potenza esplosiva.',
  },

  // ── CARDIO MACCHINE ────────────────────────────────────────────────────────
  {
    name: 'Tapis Roulant',
    lang: 'it', default_type: 'time',
    tags: ['Cardio'],
    description: 'Corsa o camminata su tapis roulant. Regolare velocità e inclinazione per modulare l\'intensità. Camminata inclinata (incline walk) ottima per il cardio a basso impatto sulle articolazioni.',
  },
  {
    name: 'Cyclette',
    lang: 'it', default_type: 'time',
    tags: ['Cardio', 'Gambe'],
    description: 'Pedalata sulla bici stazionaria. Cardio a basso impatto, indicato anche per chi ha problemi alle ginocchia. Variante upright o reclinata. Ottimo per interval training (HIIT) o steady-state.',
  },
];
