# Changelog

All notable changes to this project will be documented in this file.

## [0.0.14-beta.1] - 2025-01-27

### 🔧 Fixed
- **Connection Stability**: Risolto il problema delle disconnessioni casuali tra il plugin e la centrale Ksenia Lares 4.0
- **Error Handling**: Migliorata la gestione degli errori con recovery automatico
- **Logging**: Log più informativi per debugging e monitoraggio

### ✨ Added
- **Automatic Reconnection**: Sistema di riconnessione automatica con backoff esponenziale
- **Connection Monitoring**: Heartbeat e ping periodici per verificare lo stato della connessione
- **Health Checks**: Monitoraggio continuo della salute della connessione WebSocket
- **Command Throttling**: Protezione contro comandi troppo frequenti
- **Connection Configuration**: Nuove opzioni configurabili per personalizzare il comportamento della connessione
- **Graceful Shutdown**: Gestione pulita dello spegnimento del plugin
- **Status Reporting**: Metodi pubblici per verificare lo stato della connessione

### 🔄 Changed
- **Platform Class**: Ristrutturata la classe principale con gestione degli errori migliorata
- **Accessory Management**: Migliorata la gestione degli accessori durante le riconnessioni
- **Configuration Schema**: Aggiornato lo schema di configurazione con nuove opzioni
- **Error Messages**: Messaggi di errore più descrittivi e utili

### 📚 Documentation
- **CONNECTION_MANAGEMENT.md**: Nuova documentazione dettagliata sulla gestione della connessione
- **README.md**: Aggiornato con le nuove funzionalità e esempi di configurazione
- **Config Examples**: Esempi di configurazione per diversi scenari di utilizzo

### 🛠️ Technical Improvements
- **WebSocket Monitoring**: Accesso diretto agli eventi del WebSocket sottostante
- **Event Listeners**: Gestione migliorata degli event listener con error handling
- **Memory Management**: Prevenzione di memory leak con cleanup automatico
- **Type Safety**: Migliorata la type safety con interfacce più specifiche

### 📋 Configuration Options

Nuove opzioni in `connectionConfig`:
- `reconnectInterval`: Intervallo base tra tentativi di riconnessione (default: 5000ms)
- `maxReconnectAttempts`: Numero massimo di tentativi (-1 per infiniti)
- `heartbeatInterval`: Intervallo per controlli di salute (default: 30000ms)
- `connectionTimeout`: Timeout per connessioni iniziali (default: 10000ms)

### 🔄 Migration Guide

**Dalla versione precedente:**
1. Aggiornare il plugin alla nuova versione
2. Riavviare Homebridge
3. (Opzionale) Aggiungere configurazione `connectionConfig` per personalizzare
4. Monitorare i log per verificare il corretto funzionamento

La configurazione esistente continua a funzionare senza modifiche.

### 🐛 Bug Fixes
- Corretto il problema dei log vuoti durante le disconnessioni
- Risolte le disconnessioni che richiedevano riavvio manuale del plugin
- Eliminati gli errori silenti che causavano perdita di controllo HomeKit
- Corretto il leak di event listener durante le riconnessioni

---

## [0.0.13-beta.6] - 2024-XX-XX

### Previous Changes
- Implementazione base del plugin
- Supporto per luci, cover, scenari e termostati
- Integrazione con libreria lares4-ts