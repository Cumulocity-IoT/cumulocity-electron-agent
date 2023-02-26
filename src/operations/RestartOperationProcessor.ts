import { Client, IOperation } from "@c8y/client";
import { MqttClient } from "mqtt";
import { getPlatform } from "../hardware";
import { write, read, removeFile } from "../file-persistence";
import { OperationStatusMessageIds } from "../models/OperationProcessor";
import { CommandOperationProcessor } from "./CommandOperationProcessor";

export class RestartOperationProcessor extends CommandOperationProcessor {
  operationType = "c8y_Restart";
  protected readonly restartCmd = "reboot | sudo reboot";
  protected readonly restartLockFile = "restart.json";

  async initialize(mqttClient: MqttClient, restClient: Client): Promise<void> {
    if (getPlatform() !== "linux") {
      throw Error(`Restart only supported on linux systems`);
    }
    const filePresent = read(this.restartLockFile);
    if (filePresent) {
      this.logger.info(
        `Detected that device has previously been restarted via an operation.`
      );
      removeFile(this.restartLockFile);
      this.updateOperationStatus(mqttClient, OperationStatusMessageIds.SUCCESS);
    }

    return;
  }

  async processOperation(
    operation: IOperation,
    mqttClient: MqttClient,
    restClient: Client
  ): Promise<boolean> {
    if (
      operation[this.operationType] &&
      operation.externalSource.externalId === this.agentConfig.getClientId()
    ) {
      this.updateOperationStatus(
        mqttClient,
        OperationStatusMessageIds.EXECUTING
      );
      try {
        write({}, this.restartLockFile);
        await this.performCommand(this.restartCmd);
      } catch (e) {
        this.logger.error(e);
        const escapedString = this.escapeString(e);
        this.updateOperationStatus(
          mqttClient,
          OperationStatusMessageIds.FAILED,
          escapedString
        );
      }
      return true;
    }
    return false;
  }
}
