import { IMeasurementCreate } from "@c8y/client";
import { MqttClient } from "mqtt";
import { schedule } from "node-cron";
import { loadavg, freemem, totalmem } from "os";
import { logger } from "./logger";
import { cpuTemperature } from "systeminformation";
import { AgentConfig } from "./config";

export function setupMeasurementScheduler(
  client: MqttClient,
  agentConfig: AgentConfig
): void {
  schedule("0 * * * * *", async (time: Date) => {
    const timestamp = time.toISOString();
    const [oneMin, threeMin, fifteenMin] = loadavg();
    const measurement: Partial<IMeasurementCreate> = {
      type: "statistics",
      time: timestamp,
      loadAvg: {
        oneMin: {
          value: oneMin * 100,
          unit: "%",
        },
        threeMin: {
          value: threeMin * 100,
          unit: "%",
        },
        fifteenMin: {
          value: fifteenMin * 100,
          unit: "%",
        },
      },
      memory: {
        freemem: {
          value: Number((freemem() / 1024 / 1024).toFixed(2)),
          unit: "MB",
        },
        totalmem: {
          value: Number((totalmem() / 1024 / 1024).toFixed(2)),
          unit: "MB",
        },
      },
    };
    try {
      const temperature = await cpuTemperature();
      measurement.cpu = { main: { value: temperature.main, unit: "°C" } };
      temperature.cores.forEach((core, index) => {
        measurement.cpu[`core${index}`] = { value: core, unit: "°C" };
      });
    } catch (e) {
      logger.error("Failed to get temperature: " + e);
    }
    // logger.info(`Publishing measurement: ${JSON.stringify(measurement)}`);
    client.publish(
      "measurement/measurements/create",
      JSON.stringify(measurement),
      { qos: 1 }
    );
  });
}
