import { Client, IOperation } from "@c8y/client";
import { MqttClient } from "mqtt";
import { OperationStatusMessageIds } from "../models/OperationProcessor";
import { CommandOperationProcessor } from "./CommandOperationProcessor";
import FormData from "form-data";
import { getPlatform } from "../hardware";

export class LogRequestOperationProcessor extends CommandOperationProcessor {
  operationType = "c8y_LogfileRequest";

  async initialize(mqttClient: MqttClient, restClient: Client): Promise<void> {
    if (getPlatform() !== "linux") {
      throw Error(`LogfileRequest only supported on linux systems`);
    }
    const units = await this.getAvailableUnits();
    const escaped = units.map((unit) => this.escapeString(unit)).join(",");
    mqttClient.publish("s/us", `118,${escaped}`);
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
        const { logFile, dateFrom, dateTo, searchText, maximumLines } =
          operation[this.operationType];
        const [formattedStartDate, formattedEndDate] = [dateFrom, dateTo].map(
          (date) => this.formatDateForJournalctl(date)
        );
        const output = await this.performCommand(
          `journalctl --unit ${logFile} -S "${formattedStartDate}" -U "${formattedEndDate}" -n ${maximumLines}${
            searchText ? ` -g "${searchText}"` : ""
          } `
        );
        const url = await this.uploadFile(output, restClient);
        const escapedString = this.escapeString(url);
        this.updateOperationStatus(
          mqttClient,
          OperationStatusMessageIds.SUCCESS,
          escapedString
        );
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

  protected async uploadFile(
    content: string,
    restClient: Client
  ): Promise<string> {
    const details = await restClient.identity.detail({
      type: "c8y_Serial",
      externalId: this.agentConfig.getClientId(),
    });
    const event = await restClient.event.create({
      source: { id: `${details.data.managedObject.id}` },
      text: "Logfile Upload",
      type: "c8y_Logfile",
      time: new Date().toISOString(),
    });
    return await this.attachBinaryToEvent(
      content,
      restClient,
      `${event.data.id}`
    );
  }

  protected async attachBinaryToEvent(
    content: string,
    restClient: Client,
    eventId: string
  ): Promise<string> {
    const fileName = `file.log`;
    const body = new FormData();
    body.append(
      "object",
      JSON.stringify({ name: fileName, type: "text/plain" })
    );
    body.append("file", content, fileName);
    let bodyHeaders;
    if (typeof body.getHeaders === "function") {
      bodyHeaders = body.getHeaders();
    }
    const headers = Object.assign(
      {
        Accept: "application/json",
      },
      bodyHeaders
    );
    const response = await restClient.core.fetch(
      `/event/events/${eventId}/binaries`,
      {
        method: "POST",
        headers,
        body: body.getBuffer(),
      }
    );
    if (response.status !== 201) {
      throw Error(`Failed to upload file. Response status: ${response.status}`);
    }

    const jsonBody = await response.json();
    return jsonBody.self;
  }

  protected async getAvailableUnits(): Promise<string[]> {
    const response = await this.performCommand(
      "journalctl --field _SYSTEMD_UNIT"
    );
    const units = response
      .split("\n")
      .filter((service) => !!service)
      .sort((a, b) => a.localeCompare(b));
    return units;
  }

  protected formatDateForJournalctl(dateString: string): string {
    const [date, time] = dateString.split(/[T]/);
    const timeWithoutTimezone = time.substring(0, 8);
    return `${date} ${timeWithoutTimezone}`;
  }
}
