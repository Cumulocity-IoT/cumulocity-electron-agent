import { Client } from "@c8y/client";
import { logger } from "./logger";

const lookedUpMoIds = new Map<string, string>();

export async function createEvent(
  id: string,
  payload: string,
  client: Client
): Promise<void> {
  try {
    let moId = lookedUpMoIds.get(id);
    if (!moId) {
      const { data: details } = await client.identity.detail({
        type: "c8y_Serial",
        externalId: id,
      });
      moId = `${details.managedObject.id}`;
      lookedUpMoIds.set(id, moId);
    }

    const payloadJSON = JSON.parse(payload);
    let time: Date;
    if (payloadJSON && payloadJSON.date) {
      time = new Date(payloadJSON.date);
    } else {
      time = new Date();
    }
    await client.event.create({
      source: { id: moId },
      type: "dac_Degradation",
      text: "Degradation Event",
      dac_Degradation: JSON.parse(payload),
      time: time.toISOString(),
    });
  } catch (e) {
    logger.warn(`Failed to create event for externalId: ${id}`);
  }
}
