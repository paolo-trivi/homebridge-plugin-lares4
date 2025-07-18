# Gestione della Connessione - Homebridge Plugin Lares 4

## Problema Risolto

Questo aggiornamento risolve il problema delle disconnessioni casuali tra il plugin e la centrale Ksenia Lares 4.0, che causavano la perdita di controllo da HomeKit senza messaggi di errore chiari nei log.

## Nuove Funzionalità

### 1. Sistema di Riconnessione Automatica

- **Rilevamento automatico delle disconnessioni**: Il plugin monitora costantemente lo stato della connessione WebSocket
- **Riconnessione automatica**: In caso di perdita di connessione, il plugin tenta automaticamente di riconnettersi
- **Backoff esponenziale**: I tentativi di riconnessione aumentano progressivamente l'intervallo per evitare sovraccarico

### 2. Monitoraggio della Connessione (Heartbeat)

- **Ping periodici**: Invio di ping alla centrale per verificare che la connessione sia attiva
- **Timeout detection**: Rilevamento di connessioni "zombie" che sembrano aperte ma non rispondono
- **Status monitoring**: Monitoraggio degli aggiornamenti di stato per verificare l'attività della connessione

### 3. Gestione degli Errori Migliorata

- **Error recovery**: Gestione robusta degli errori con recupero automatico
- **Logging dettagliato**: Log più informativi per il debugging
- **Graceful degradation**: Comportamento controllato in caso di errori

### 4. Throttling dei Comandi

- **Protezione da spam**: Prevenzione di comandi troppo frequenti che potrebbero sovraccaricare la centrale
- **Queue management**: Gestione intelligente delle richieste

## Configurazione

### Configurazione Base

La configurazione minima rimane invariata:

```json
{
  "platforms": [
    {
      "platform": "Lares4HomebridgePlugin",
      "name": "Lares4HomebridgePlugin",
      "ip": "192.168.0.1",
      "pin": "1234",
      "sender": "9ab4c4e7-0ce5-48d8-8c15-3714347036a7-i1",
      "coverTimeout": 30,
      "thermostatManualTimeout": 2
    }
  ]
}
```

### Configurazione Avanzata

Per personalizzare il comportamento della connessione, aggiungi la sezione `connectionConfig`:

```json
{
  "platforms": [
    {
      "platform": "Lares4HomebridgePlugin",
      "name": "Lares4HomebridgePlugin",
      "ip": "192.168.0.1",
      "pin": "1234",
      "sender": "9ab4c4e7-0ce5-48d8-8c15-3714347036a7-i1",
      "coverTimeout": 30,
      "thermostatManualTimeout": 2,
      "connectionConfig": {
        "reconnectInterval": 5000,
        "maxReconnectAttempts": -1,
        "heartbeatInterval": 30000,
        "connectionTimeout": 10000
      }
    }
  ]
}
```

## Parametri di Configurazione

### `reconnectInterval` (default: 5000ms)
- Intervallo base tra i tentativi di riconnessione
- **Consigliato**: 3000-10000ms
- **Valore più basso**: Riconnessione più rapida, ma maggior carico di rete
- **Valore più alto**: Minor carico di rete, ma riconnessione più lenta

### `maxReconnectAttempts` (default: -1)
- Numero massimo di tentativi di riconnessione
- **-1**: Tentativi infiniti (consigliato)
- **Numero positivo**: Limite massimo di tentativi

### `heartbeatInterval` (default: 30000ms)
- Intervallo tra i controlli di salute della connessione
- **Consigliato**: 15000-60000ms
- **Valore più basso**: Rilevamento più rapido delle disconnessioni, ma maggior traffico
- **Valore più alto**: Minor traffico, ma rilevamento più lento

### `connectionTimeout` (default: 10000ms)
- Timeout per i tentativi di connessione iniziale
- **Consigliato**: 5000-15000ms
- **Valore più basso**: Rilevamento più rapido di problemi di rete
- **Valore più alto**: Maggior tolleranza per connessioni lente

## Scenari di Utilizzo

### Rete Stabile (Casa con WiFi affidabile)
```json
"connectionConfig": {
  "reconnectInterval": 5000,
  "maxReconnectAttempts": -1,
  "heartbeatInterval": 30000,
  "connectionTimeout": 10000
}
```

### Rete Instabile (WiFi debole o intermittente)
```json
"connectionConfig": {
  "reconnectInterval": 3000,
  "maxReconnectAttempts": -1,
  "heartbeatInterval": 15000,
  "connectionTimeout": 8000
}
```

### Ambiente con Risorse Limitate
```json
"connectionConfig": {
  "reconnectInterval": 10000,
  "maxReconnectAttempts": 10,
  "heartbeatInterval": 60000,
  "connectionTimeout": 15000
}
```

## Monitoraggio e Debug

### Log di Connessione

Il plugin ora fornisce log dettagliati sullo stato della connessione:

```
[Lares4] Initializing Lares4 connection...
[Lares4] Lares4 connection established successfully
[Lares4] Successfully configured 12 accessories
[Lares4] Sent ping to keep connection alive
[Lares4] Connection lost - initiating reconnection...
[Lares4] Scheduling reconnection attempt 1 in 5s
```

### Status della Connessione

È possibile verificare lo stato della connessione tramite i metodi pubblici:

- `platform.isConnected()`: Restituisce true se la connessione è attiva
- `platform.getConnectionHealth()`: Restituisce informazioni dettagliate sullo stato

## Risoluzione dei Problemi

### Problema: Riconnessioni Troppo Frequenti
**Sintomo**: Log pieni di tentativi di riconnessione
**Soluzione**: 
- Aumentare `reconnectInterval` e `heartbeatInterval`
- Verificare la stabilità della rete
- Controllare che la centrale non sia sovraccarica

### Problema: Rilevamento Lento delle Disconnessioni
**Sintomo**: HomeKit non risponde per lungo tempo prima della riconnessione
**Soluzione**:
- Diminuire `heartbeatInterval`
- Diminuire `connectionTimeout`

### Problema: Eccessivo Consumo di Risorse
**Sintomo**: CPU o memoria alta
**Soluzione**:
- Aumentare `heartbeatInterval`
- Aumentare `reconnectInterval`
- Limitare `maxReconnectAttempts`

### Problema: Connessione non si Stabilizza
**Sintomo**: Connessioni continue senza successo
**Soluzione**:
1. Verificare IP e credenziali della centrale
2. Controllare firewall e porte
3. Aumentare `connectionTimeout`
4. Verificare che la centrale supporti WebSocket

## Compatibilità

- **Homebridge**: 1.8.0 o superiore
- **Node.js**: 18.20.4, 20.18.0, o 22.10.0
- **Ksenia Lares 4.0**: Tutte le versioni con supporto WebSocket

## Note Tecniche

- La riconnessione è completamente trasparente per HomeKit
- Gli accessori mantengono il loro stato durante le riconnessioni
- Il sistema gestisce automaticamente la pulizia delle risorse
- I comandi vengono respinti durante le disconnessioni con errori appropriati

## Aggiornamento dalla Versione Precedente

1. Aggiornare il plugin alla nuova versione
2. Riavviare Homebridge
3. (Opzionale) Aggiungere la configurazione `connectionConfig` per personalizzare il comportamento
4. Monitorare i log per verificare il corretto funzionamento

La configurazione esistente continuerà a funzionare senza modifiche, utilizzando i valori predefiniti per le nuove funzionalità.