// const values = ['A', 'B'] as const;
export const mqttProtocols = ["mqtt", "mqtts", "ws", "wss"] as const;
export const httpProtocols = ["http", "https"] as const;
type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never;

// type Foo = ElementType<typeof values>; // this is correctly inferred as literal "A" | "B"
export interface IConfiguration {
  domain: string;
  clientId: string;
  mqttPort: number;
  mqttProtocol: ElementType<typeof mqttProtocols>;
  httpPort: number;
  httpProtocol: ElementType<typeof httpProtocols>;
  [key: string]: any;
}
