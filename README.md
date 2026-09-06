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

## Prima accensione

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
- Chi apre il link senza chiave vede solo la richiesta della chiave: nessun numero.
- Se perdi il telefono: GitHub → *Settings* → *Developer settings* → *Fine-grained tokens*
  → **Revoke**. La chiave diventa carta straccia all'istante.
- Nota: tutti i siti che pubblichi su `<tuo-utente>.github.io` condividono lo stesso
  `localStorage`. La chiave è in sola lettura su un repo senza segreti, quindi il rischio è
  minimo, ma tienilo presente se pubblichi altri siti lì.
- Dentro `trading-app` non va mai messo un file di stato del portafoglio: il repo è pubblico.

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
index.html                 le due schermate: richiesta chiave e app
css/style.css              tema scuro, pensato prima per il telefono
js/config.js               repo, coppie, formattazione dei numeri all'italiana
js/gate.js                 la porta: chiave, salvataggio, "dimentica chiave"
js/github.js               lettura di portfolio.json dal repo privato (con ETag)
js/prices.js               tick dal vivo (Binance, ricaduta su Kraken) e candele storiche
js/equity.js               tutti i conti: valore, P&L, ricostruzione della curva
js/chart.js                il grafico
js/app.js                  mette insieme le cose e disegna
sw.js                      apertura istantanea offline (solo il guscio, mai i dati)
manifest.webmanifest       nome e icone per l'installazione sul telefono
```

## Cosa NON fa

Guarda e basta: non ci sono pulsanti compra/vendi e non tocca in alcun modo il bot.
Per cambiare come opera il bot si mette mano a `trading-bot/config.yaml`, non qui.
