import { Client, IOperation } from "@c8y/client";
import { MqttClient } from "mqtt";
import { AgentConfig } from "../config";
import { logger } from "../logger";

export enum OperationStatusMessageIds {
  EXECUTING = "501",
  FAILED = "502",
  SUCCESS = "503",
}

export abstract class OperationProcessor {
  abstract operationType: string;
  readonly agentConfig: AgentConfig;
  logger = logger;

  constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig;
  }

  async initialize(mqttClient: MqttClient, restClient: Client): Promise<void> {
    // per default nothing is to be done
  }

  async processOperation(
    operation: IOperation,
    mqttClient: MqttClient,
    restClient: Client
  ): Promise<boolean> {
    return false;
  }

  protected updateOperationStatus(
    mqttClient: MqttClient,
    status: OperationStatusMessageIds,
    additions?: string
  ) {
    const payload = `${status},${this.operationType}${
      additions ? "," + additions : ""
    }`;
    logger.info(
      `Updating Operation (${this.operationType}) with statuscode: ${status}`
    );
    mqttClient.publish("s/us", payload, { qos: 1 });
  }

  protected unescapeString(cmd: string): string {
    if (cmd.startsWith('"') && cmd.endsWith('"')) {
      cmd = cmd.substring(1, cmd.length - 1);
    }
    return cmd;
  }

  protected escapeString(result: string): string {
    const charsRequiringSurroundingQuotes = ['"', ",", " ", "\r", "\n", "\t"];
    const needsSurroundingQuotes = charsRequiringSurroundingQuotes.some(
      (char) => result.includes(char)
    );
    result = result.replace(/"/g, '""');
    return needsSurroundingQuotes ? `"${result}"` : result;
  }
}
