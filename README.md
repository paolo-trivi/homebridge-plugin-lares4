# Homebridge Lares 4 Plugin

A Homebridge plugin to integrate Ksenia Lares 4.0 home automation systems with the Apple HomeKit ecosystem.

## Features

- **Automatic connection management**: Robust WebSocket connection with automatic reconnection
- **Real-time device control**: Control lights, dimmers, shutters, and scenarios
- **Thermostat support**: Full integration with Ksenia thermostats
- **Status monitoring**: Real-time status updates from your Lares 4 system
- **Connection resilience**: Advanced error handling and recovery mechanisms

## Recent Updates

### ✨ Enhanced Connection Management (v0.0.13-beta.6+)

This plugin now includes advanced connection management features to resolve random disconnection issues:

- **Automatic Reconnection**: Seamless reconnection when connection is lost
- **Health Monitoring**: Continuous connection health checks with configurable intervals
- **Error Recovery**: Robust error handling with graceful degradation
- **Command Throttling**: Protection against command flooding

See [CONNECTION_MANAGEMENT.md](./CONNECTION_MANAGEMENT.md) for detailed information.

## Installation

```bash
npm install -g homebridge-plugin-lares4
```

## Configuration

### Basic Configuration

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

### Advanced Configuration with Connection Management

```json
{
  "platforms": [
    {
      "platform": "Lares4HomebridgePlugin",
      "name": "Lares4HomebridgePlugin",
      "ip": "192.168.0.1",
      "pin": "1234",
      "sender": "9ab4c4e7-0ce5-48d8-8c15-3714347036a7-i1",
      "https": true,
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

## Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | string | Yes | - | Must be "Lares4HomebridgePlugin" |
| `name` | string | Yes | - | Display name for the platform |
| `ip` | string | Yes | - | IP address of your Lares 4 panel |
| `pin` | string | Yes | - | PIN code for your Lares 4 user |
| `sender` | string | Yes | - | Sender ID (use default if unsure) |
| `https` | boolean | No | true | Use HTTPS/WSS for connection |
| `coverTimeout` | integer | Yes | 30 | Timeout for cover operations (seconds) |
| `thermostatManualTimeout` | integer | Yes | 2 | Manual thermostat timeout (hours, 0 to disable) |

### Connection Configuration (`connectionConfig`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reconnectInterval` | integer | 5000 | Base interval between reconnection attempts (ms) |
| `maxReconnectAttempts` | integer | -1 | Max reconnection attempts (-1 for infinite) |
| `heartbeatInterval` | integer | 30000 | Connection health check interval (ms) |
| `connectionTimeout` | integer | 10000 | Initial connection timeout (ms) |

## Supported Devices

- **Lights**: On/off switches and dimmable lights
- **Shutters**: Motorized blinds and covers with position control
- **Scenarios**: Activation of predefined scenarios
- **Gates**: Gate and door controls
- **Thermostats**: Temperature control and monitoring
- **Sensors**: Temperature and light sensors

## Troubleshooting

### Connection Issues

If you experience random disconnections:

1. **Check network stability**: Ensure your WiFi connection to the Lares 4 panel is stable
2. **Adjust connection settings**: Fine-tune the `connectionConfig` parameters
3. **Monitor logs**: Check Homebridge logs for detailed connection information
4. **Update firmware**: Ensure your Lares 4 panel has the latest firmware

### Common Solutions

**For unstable networks:**
```json
"connectionConfig": {
  "reconnectInterval": 3000,
  "heartbeatInterval": 15000,
  "connectionTimeout": 8000
}
```

**For resource-constrained environments:**
```json
"connectionConfig": {
  "reconnectInterval": 10000,
  "heartbeatInterval": 60000,
  "maxReconnectAttempts": 10
}
```

### Log Examples

Successful connection:
```
[Lares4] Initializing Lares4 connection...
[Lares4] Lares4 connection established successfully
[Lares4] Successfully configured 12 accessories
```

Connection recovery:
```
[Lares4] Connection lost - initiating reconnection...
[Lares4] Scheduling reconnection attempt 1 in 5s
[Lares4] Lares4 connection established successfully
```

## Requirements

- **Homebridge**: 1.8.0 or later
- **Node.js**: 18.20.4, 20.18.0, or 22.10.0
- **Ksenia Lares 4.0**: Any version with WebSocket support

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support and issues, please visit the [GitHub repository](https://github.com/glsorre/homebridge-plugin-lares4/issues).
