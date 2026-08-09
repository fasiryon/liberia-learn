import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

type MetricUnit = "Count" | "Milliseconds" | "Percent";

let cachedClient: CloudWatchClient | null = null;

function getClient(region: string): CloudWatchClient {
  if (!cachedClient) {
    cachedClient = new CloudWatchClient({ region });
  }
  return cachedClient;
}

function getConfig() {
  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "";
  const namespace = process.env.CLOUDWATCH_NAMESPACE?.trim() || "";

  if (!region || !namespace) {
    console.warn(
      "[CloudWatch] metric skipped - AWS_REGION or CLOUDWATCH_NAMESPACE not configured"
    );
    return null;
  }

  return { region, namespace };
}

export async function publishMetric(params: {
  metricName: string;
  value: number;
  unit: MetricUnit;
  dimensions?: Record<string, string>;
}): Promise<void> {
  const config = getConfig();
  if (!config) {
    return;
  }

  try {
    const client = getClient(config.region);
    await client.send(
      new PutMetricDataCommand({
        Namespace: config.namespace,
        MetricData: [
          {
            MetricName: params.metricName,
            Value: params.value,
            Unit: params.unit,
            Dimensions: Object.entries(params.dimensions ?? {}).map(([Name, Value]) => ({
              Name,
              Value,
            })),
          },
        ],
      })
    );
  } catch (error) {
    console.error("[CloudWatch] publishMetric failed", error);
  }
}
