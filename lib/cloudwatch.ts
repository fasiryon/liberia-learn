import { createHash, createHmac } from "crypto";

type MetricUnit = "Count" | "Milliseconds" | "Percent";

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
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

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() || "";
  if (!accessKeyId || !secretAccessKey) {
    console.warn(
      "[CloudWatch] metric skipped - AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not configured"
    );
    return null;
  }

  return {
    region,
    namespace,
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim() || "",
  };
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
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const host = `monitoring.${config.region}.amazonaws.com`;
    const endpoint = `https://${host}/`;

    const parts: string[] = [
      `Action=${encodeRfc3986("PutMetricData")}`,
      `Version=${encodeRfc3986("2010-08-01")}`,
      `Namespace=${encodeRfc3986(config.namespace)}`,
      `MetricData.member.1.MetricName=${encodeRfc3986(params.metricName)}`,
      `MetricData.member.1.Value=${encodeRfc3986(String(params.value))}`,
      `MetricData.member.1.Unit=${encodeRfc3986(params.unit)}`,
    ];

    Object.entries(params.dimensions ?? {}).forEach(([name, value], index) => {
      const member = index + 1;
      parts.push(
        `MetricData.member.1.Dimensions.member.${member}.Name=${encodeRfc3986(name)}`
      );
      parts.push(
        `MetricData.member.1.Dimensions.member.${member}.Value=${encodeRfc3986(value)}`
      );
    });

    const body = parts.join("&");
    const canonicalHeaders = [
      "content-type:application/x-www-form-urlencoded; charset=utf-8",
      `host:${host}`,
      `x-amz-date:${amzDate}`,
      ...(config.sessionToken ? [`x-amz-security-token:${config.sessionToken}`] : []),
    ].join("\n");
    const signedHeaders = config.sessionToken
      ? "content-type;host;x-amz-date;x-amz-security-token"
      : "content-type;host;x-amz-date";
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      "",
      signedHeaders,
      sha256Hex(body),
    ].join("\n");

    const credentialScope = `${dateStamp}/${config.region}/monitoring/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, config.region);
    const kService = hmac(kRegion, "monitoring");
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning)
      .update(stringToSign, "utf8")
      .digest("hex");
    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        host,
        "x-amz-date": amzDate,
        ...(config.sessionToken ? { "x-amz-security-token": config.sessionToken } : {}),
        Authorization: authorization,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[CloudWatch] PutMetricData failed", {
        status: response.status,
        body: text.slice(0, 500),
      });
    }
  } catch (error) {
    console.error("[CloudWatch] publishMetric failed", error);
  }
}
