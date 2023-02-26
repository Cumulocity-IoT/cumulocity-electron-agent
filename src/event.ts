import { MqttClient } from "mqtt";
import { logger } from "./logger";

export enum AgentStatus {
  STARTUP = "startup",
  SHUTDOWN = "shutdown",
  DISCONNECT = "disconnect",
  CLOSE = "close",
  ERROR = "error",
  RECONNECT = "reconnect",
  CONNECTIONLOSS = "connectionloss",
}

export function createStatusEvent(
  mqttClient: MqttClient,
  status: AgentStatus,
  text?: string
) {
  logger.info(`Sending event with status: ${status}`);
  mqttClient.publish(
    "s/us",
    `400,"ts_${status}","${text || status}","${new Date().toISOString()}"`,
    { qos: 1 }
  );
}
