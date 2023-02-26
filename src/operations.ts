import { Client, IOperation } from "@c8y/client";
import { MqttClient } from "mqtt";
import { AgentConfig } from "./config";
import { logger } from "./logger";
import { OperationProcessor } from "./models/OperationProcessor";
import { CommandOperationProcessor } from "./operations/CommandOperationProcessor";
import { ConfigurationOperationProcessor } from "./operations/ConfigurationOperationProcessor";
import { LogRequestOperationProcessor } from "./operations/LogRequestOperationProcessor";
import { RemoteAccessConnectOperationProcessor } from "./operations/RemoteAccessConnectOperationProcessor";
import { RestartOperationProcessor } from "./operations/RestartOperationProcessor";
import { WebcamOperationProcessor } from "./operations/webcam/WebcamOperationProcessor";

const operationQueuJSON: IOperation[] = [];
let operationProcessors: OperationProcessor[] = [];

export async function registerListenerForOperations(
  mqttClient: MqttClient,
  restClient: Client,
  agentConfig: AgentConfig
): Promise<void> {
  operationProcessors = [
    new RemoteAccessConnectOperationProcessor(agentConfig),
    new CommandOperationProcessor(agentConfig),
    new RestartOperationProcessor(agentConfig),
    new LogRequestOperationProcessor(agentConfig),
    new ConfigurationOperationProcessor(agentConfig),
    new WebcamOperationProcessor(agentConfig),
  ];
  await initializeProcessors(mqttClient, restClient);
  const supportedOperationTypes = operationProcessors.map(
    (tmp) => tmp.operationType
  );
  addSupportedOperations(mqttClient, supportedOperationTypes);
  mqttClient.on("message", (topic, payload) => {
    if (!topic) {
      return;
    }
    const message = String(payload);
    logger.info(`Message received on topic: ${topic}`);
    if (
      topic === "devicecontrol/notifications" ||
      topic === "notification/operations"
    ) {
      logger.debug(message);
      try {
        const operation: IOperation = JSON.parse(message);
        operationQueuJSON.push(operation);
        if (operationQueuJSON.length === 1) {
          processQueuItems(mqttClient, restClient).then(
            () => {
              logger.info(`Processed all items of queu successfully.`);
            },
            () => {
              logger.warn(`Failed to process all items successfully.`);
            }
          );
        }
      } catch (e) {
        logger.error(e);
      }
    } else {
      logger.info(message);
    }
  });
  requestPendingOperations(mqttClient);
}

function requestPendingOperations(mqttClient: MqttClient) {
  logger.info(`Requesting pending operations.`);
  mqttClient.publish("s/us", `500`, {
    qos: 1,
  });
}

async function initializeProcessors(
  mqttClient: MqttClient,
  restClient: Client
) {
  const failedProcessors: OperationProcessor[] = [];
  for (const processor of operationProcessors) {
    const className = processor.constructor.name;
    try {
      logger.info(`Initializing processor: ${className}`);
      await processor.initialize(mqttClient, restClient);
    } catch (e) {
      logger.warn(`An error occured while initializing: ${className}`);
      failedProcessors.push(processor);
    }
  }

  operationProcessors = operationProcessors.filter(
    (processor) => !failedProcessors.includes(processor)
  );
}

function addSupportedOperations(
  client: MqttClient,
  supportedOperations: string[] = []
) {
  client.publish("s/us", `114,${supportedOperations.join(",")}`, {
    qos: 1,
  });
}

async function processQueuItems(mqttClient: MqttClient, restClient: Client) {
  while (operationQueuJSON.length) {
    const cmd = operationQueuJSON[0];
    let processedByOneProcessor = false;
    for (const processor of operationProcessors) {
      try {
        const processed = await processor.processOperation(
          cmd,
          mqttClient,
          restClient
        );
        if (processed) {
          logger.info(
            `Operation has been processed by: ${processor.constructor.name}`
          );
          processedByOneProcessor = true;
          break;
        }
      } catch (e) {
        logger.warn(
          `An error occured while processing: ${JSON.stringify(cmd)}`
        );
        logger.error(`Error: ${JSON.stringify(e)}`);
      }
    }

    if (!processedByOneProcessor) {
      logger.warn(`No processor found for Operation: ${cmd}`);
    }

    operationQueuJSON.splice(0, 1);
  }
}
