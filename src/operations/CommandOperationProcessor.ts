import { Client, IOperation } from '@c8y/client';
import { exec } from 'child_process';
import { MqttClient } from 'mqtt';
import { OperationProcessor, OperationStatusMessageIds } from '../models/OperationProcessor';

export class CommandOperationProcessor extends OperationProcessor {
  operationType = 'c8y_Command';

  async initialize(mqttClient: MqttClient, restClient: Client): Promise<void> {
    return;
  }

  async processOperation(operation: IOperation, mqttClient: MqttClient, restClient: Client): Promise<boolean> {
    if (operation[this.operationType] && operation.externalSource.externalId === this.agentConfig.getClientId()) {
      this.updateOperationStatus(mqttClient, OperationStatusMessageIds.EXECUTING);
      try {
        const { text } = operation[this.operationType];
        const res = await this.performCommand(text);
        const escapedString = this.escapeString(res);
        this.updateOperationStatus(mqttClient, OperationStatusMessageIds.SUCCESS, escapedString);
      } catch (e) {
        this.logger.error(e);
        const escapedString = this.escapeString(e);
        this.updateOperationStatus(mqttClient, OperationStatusMessageIds.FAILED, escapedString);
      }
      return true;
    }
    return false;
  }

  protected performCommand(cmd: string): Promise<string> {
    this.logger.info(`Executing command: ${cmd}`);
    return new Promise<string>((resolve, reject) => {
      const child = exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
        if (child.exitCode !== 0) {
          this.logger.info(`exitcode: ${child.exitCode}`);
          return reject(stderr || err?.message);
        } else {
          return resolve(stdout);
        }
      });
    });
  }
}
