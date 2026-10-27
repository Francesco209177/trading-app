# Portafoglio Bot

Il portafoglio del tuo trading bot, in tempo reale, sul telefono e sul PC.

Non è una simulazione dentro la simulazione: la liquidità e le quantità sono quelle vere
registrate dal bot, i prezzi sono quelli veri del mercato. Il numero grande è semplicemente

```
valore = liquidità + Σ (quantità × prezzo di adesso)
```

ricalcolato a ogni battito del mercato. (I soldi restano finti perché il bot è in simulazione.)

Gli importi sono mostrati in **euro**, convertiti al cambio del momento: il bot tiene i conti in
USDT, quindi le **percentuali sono identiche** ma le cifre in euro possono differire dal resoconto
su Telegram. Il cambio usato è sempre visibile nelle Impostazioni.

## Le pagine

Una barra in basso porta a 5 sezioni, tutte dentro la stessa pagina (nessuna ricarica):

| Pagina | Cosa mostra |
|---|---|
| **Home** | Il dashboard di sempre: valore live, grafico, posizioni, ultime operazioni, più un piccolo riepilogo in cima con il **segnale di oggi** ("resta investito", "venderà alle 8"…). Sotto ogni posizione: a che prezzo scatterebbe lo **stop-loss** e quanto manca. |
| **Storico** | Tutte le operazioni del bot, filtrabili per moneta. |
| **Statistiche** | Operazioni chiuse e il loro guadagno realizzato, giorno migliore e peggiore, confronto con "se avesse solo comprato e tenuto senza mai più toccare nulla". |
| **Confronto** | BTC ed ETH separati, ognuno col proprio grafico di prezzo, la propria posizione e il **canale dei prezzi** (minimo di 20 e massimo di 55 giorni) con la distanza tra loro. |
| **Come funziona** | Spiega in parole semplici la strategia del bot (nessun dato live, si apre anche offline). |

---

## Come funziona

| Pezzo | Da dove arriva | Ogni quanto |
|---|---|---|
| Liquidità, posizioni, operazioni, storico | `state/portfolio.json` nel repo **privato** `trading-bot` | letto ogni 60 secondi |
| Prezzi BTC/ETH | WebSocket di Binance (se cade, Kraken) | a ogni scambio |
| Curva del passato | candele storiche + le operazioni del bot | a ogni cambio di periodo |
| Cambio USDT→EUR | Binance (`EURUSDT`), ripiego Frankfurter | all'avvio e ogni 30 minuti |

Non c'è nessun server: è un sito statico. I dati non passano da nessuna parte se non dal
tuo browser.

---

## Dati pubblici, senza chiave (dal 27/10/2026)

Su richiesta, il sito non chiede più la chiave. Ogni ora il bot copia **solo** il
portafoglio simulato (`state/portfolio.json`: liquidità, posizioni, storico del valore,
operazioni) nel ramo **`dati`** di questo repo pubblico. Sito e app lo leggono da
`https://raw.githubusercontent.com/Francesco209177/trading-app/dati/portfolio.json`.

- Il codice del bot e i suoi segreti (Telegram, email) restano nel repo **privato**.
- Chiunque abbia il link vede il portafoglio simulato: sono soldi finti, ma è una scelta.
- Il ramo `dati` tiene un solo commit, riscritto a ogni pubblicazione.
- Il bot scrive qui con una *deploy key* (`DATI_DEPLOY_KEY` tra i segreti di
  `trading-bot`) che vale solo per questo repo.
- Per tornare alla chiave: in `js/config.js` metti `publicState: ""` e togli il passo
  "Pubblica i dati per l'app" dal workflow del bot (e la deploy key da questo repo).

Le istruzioni qui sotto servono solo se si torna alla chiave.

## App Android (APK)

In `android/` c'è un'app minima che apre questo sito a schermo intero: niente Gradle,
niente librerie, 88 KB. Siccome carica il sito da GitHub Pages, ogni miglioria al sito
arriva anche nell'app senza bisogno di un nuovo APK.

- Costruirla: `android/build.sh` → `~/Documenti/PortafoglioBot-<versione>.apk`
  (servono `~/android-tools/sdk` e `~/android-tools/jdk`, e Pillow per le icone).
- Nuova versione: alza `versionCode` e `versionName` in `android/AndroidManifest.xml`.
- **Firma**: la chiave è in `~/PortafoglioBot-firma` (fuori dal repo, che è pubblico).
  Non perderla: senza la stessa chiave il telefono non accetta l'aggiornamento e
  bisogna disinstallare l'app.
- Tasto Indietro del telefono: chiude le impostazioni, poi torna alla Home, e solo
  dalla Home esce (usa `Router.current` in `js/router.js`).
- I link esterni si aprono nel browser del telefono, non dentro l'app.

## Prima accensione (con la chiave, non più necessaria)

### 1. Crea la chiave di lettura

1. GitHub → foto profilo → **Settings**
2. In fondo a sinistra: **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. Nome: `portafoglio-bot`. Scadenza: 90 giorni
5. **Repository access** → *Only select repositories* → **trading-bot**
6. **Permissions** → *Repository permissions* → **Contents: Read-only**
7. Genera e copia la chiave

Questa chiave **non può scrivere niente** e vede **solo** quel repo.

### 2. Pubblica l'app

Crea su GitHub un repo **pubblico** chiamato `trading-app`, carica dentro questi file, poi:

**Settings** → **Pages** → *Source: Deploy from a branch* → branch `main`, cartella `/ (root)` → **Save**.

Dopo un minuto l'app è su `https://<tuo-utente>.github.io/trading-app/`.

Nel repo pubblico c'è **solo codice**: nessun numero, nessuna chiave.

### 3. Installala sul telefono (Android)

Apri il link con Chrome → menu **⋮** → **Installa app** (o *Aggiungi a schermata Home*).
Diventa un'icona come le altre, a schermo intero.

La prima volta ti chiede la chiave: incollala. Resta salvata su quel dispositivo, va fatto
una volta per telefono e una volta per PC.

---

## Sicurezza

- La chiave sta **solo** nel `localStorage` del browser dove l'hai incollata. Non è in
  nessun file, non passa nell'indirizzo, non entra nella cache dell'app.
- Chi apre il link senza chiave vede solo la richiesta della chiave, più un pulsante per la
  **demo**: un portafoglio inventato costruito coi prezzi veri. Nessun dato del bot vero.
- Se perdi il telefono: GitHub → *Settings* → *Developer settings* → *Fine-grained tokens*
  → **Revoke**. La chiave diventa carta straccia all'istante.
- Nota: tutti i siti che pubblichi su `<tuo-utente>.github.io` condividono lo stesso
  `localStorage`. La chiave è in sola lettura su un repo senza segreti, quindi il rischio è
  minimo, ma tienilo presente se pubblichi altri siti lì.
- Il ramo `main` di `trading-app` contiene solo codice. Il portafoglio simulato sta nel
  ramo `dati`, pubblico per scelta (vedi sopra).

## Se qualcosa non va

| Sintomo | Cosa succede |
|---|---|
| "Chiave rifiutata" | scaduta o revocata: creane un'altra e reincollala |
| "Non trovo il repo" | la chiave non ha `trading-bot` tra i repository selezionati |
| Numeri fermi, pallino rosso | i prezzi non arrivano: l'app riprova da sola, anche cambiando exchange |
| Grafico vuoto | Binance e Kraken irraggiungibili: riprova più tardi |

---

## Sviluppo in locale

```bash
python -m http.server 8123
```

poi apri `http://127.0.0.1:8123`. Serve un server (anche questo basta): aprendo il file
`index.html` col doppio clic il browser blocca le chiamate di rete.

## I file

```
index.html                 richiesta chiave + le 5 pagine dell'app
css/style.css              tema scuro, pensato prima per il telefono
js/config.js               repo, regole del bot (medie, stop-loss), numeri all'italiana
js/gate.js                 la porta: chiave, salvataggio, "dimentica chiave"
js/github.js               lettura di portfolio.json dal repo privato (con ETag)
js/prices.js               tick dal vivo (Binance, ricaduta su Kraken) e candele storiche
js/demo.js                 la demo per chi non ha la chiave: portafoglio inventato, prezzi veri
js/signal.js               "cosa farà il bot": canale Donchian 55/20 e prezzo dello stop-loss
js/equity.js               i conti dell'equity: valore, P&L, ricostruzione della curva
js/currency.js             conversione USDT → euro, condivisa da tutte le pagine
js/chart.js                fabbrica di grafici (ogni pagina che ne apre uno ha il proprio)
js/router.js               cambia pagina senza ricaricare, tiene la barra in basso allineata
js/stats.js                i calcoli di Statistiche: operazioni chiuse, giorni, confronto
js/history.js              la pagina Storico
js/view-stats.js           la pagina Statistiche (disegna i numeri di js/stats.js)
js/compare.js              la pagina Confronto BTC/ETH
js/app.js                  Home: mette insieme le cose e disegna
sw.js                      apertura istantanea offline (solo il guscio, mai i dati)
manifest.webmanifest       nome e icone per l'installazione sul telefono
```

## Cosa NON fa

Guarda e basta: non ci sono pulsanti compra/vendi e non tocca in alcun modo il bot.
Per cambiare come opera il bot si mette mano a `trading-bot/config.yaml`, non qui.
