import { Client, IOperation } from '@c8y/client';
import { MqttClient } from 'mqtt';
import { Socket } from 'net';
import { getAuthHeader } from '../credentials';
import { MessageEvent, WebSocket } from 'ws';
import { OperationProcessor, OperationStatusMessageIds } from '../models/OperationProcessor';

export class RemoteAccessConnectOperationProcessor extends OperationProcessor {
  operationType = 'c8y_RemoteAccessConnect';

  async initialize(mqttClient: MqttClient, restClient: Client): Promise<void> {
    return;
  }

  async processOperation(operation: IOperation, mqttClient: MqttClient, restClient: Client): Promise<boolean> {
    if (operation[this.operationType] && operation.externalSource.externalId === this.agentConfig.getClientId()) {
      this.updateOperationStatus(mqttClient, OperationStatusMessageIds.EXECUTING);
      try {
        const { hostname, port, connectionKey } = operation[this.operationType];
        this.logger.info(`Establishing Remote Access Connection to: ${hostname} on port: ${port}`);
        this.establishRemoteConnection(hostname, Number(port), connectionKey, mqttClient);
        this.updateOperationStatus(mqttClient, OperationStatusMessageIds.SUCCESS);
      } catch (e) {
        this.logger.error(e);
        const escapedString = this.escapeString(e);
        this.updateOperationStatus(mqttClient, OperationStatusMessageIds.FAILED, escapedString);
      }
      return true;
    }
    return false;
  }

  protected establishRemoteConnection(host: string, port: number, connectionKey: string, mqttClient: MqttClient): void {
    const webSocket = new WebSocket(
      `wss://${this.agentConfig.getDomain()}/service/remoteaccess/device/${connectionKey}`,
      ['binary'],
      {
        headers: {
          Authorization: getAuthHeader()
        }
      }
    );

    const socket = new Socket();
    webSocket.onmessage = (ev: MessageEvent) => {
      const messagePayload = String(ev.data);
      if (typeof ev.data === 'string') {
        this.logger.debug('WS string: ' + JSON.stringify(messagePayload));
        socket.write(ev.data);
      } else if (ev.data instanceof Buffer) {
        this.logger.debug('WS Buffer: ' + JSON.stringify(messagePayload));
        socket.write(ev.data);
      } else if (ev.data instanceof ArrayBuffer) {
        this.logger.debug('WS ArrayBuffer: ' + JSON.stringify(messagePayload));
        socket.write(messagePayload);
      } else if (Array.isArray(ev.data)) {
        this.logger.debug('WS Array: ' + JSON.stringify(messagePayload));
        socket.write(messagePayload);
      } else {
        this.logger.debug('WS else: ' + JSON.stringify(messagePayload));
        socket.write(messagePayload);
      }
    };
    webSocket.onerror = (e) => {
      this.logger.error('Websocket: error' + JSON.stringify(e));
    };
    webSocket.onclose = () => {
      this.logger.info(`Websocket connection to: ${this.agentConfig.getDomain()} closed.`);
      socket.end();
    };
    webSocket.onopen = () => {
      this.logger.info(`Websocket connection to: ${this.agentConfig.getDomain()} established.`);
      socket.connect({ host, port });
      socket.on('data', (data) => {
        const messagePayload = String(data);
        this.logger.debug('Socket: ' + JSON.stringify(messagePayload));
        webSocket.send(data);
      });
      socket.on('close', () => {
        this.logger.info(`Connection to socket: ${host}:${port} closed.`);
        this.logger.debug('Socket: closed');
        webSocket.close();
      });
      socket.on('error', (e) => {
        this.logger.error('Socket: error' + JSON.stringify(e));
      });
      socket.on('connect', () => {
        this.logger.info(`Connection to socket: ${host}:${port} established.`);
      });
    };
  }
}
