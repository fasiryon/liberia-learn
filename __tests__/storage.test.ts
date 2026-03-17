import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const getSignedUrlMock = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

import { getExportSignedUrl, uploadExport } from "@/lib/storage";

const s3Mock = mockClient(S3Client);

describe("lib/storage", () => {
  beforeEach(() => {
    s3Mock.reset();
    getSignedUrlMock.mockReset();
    process.env.AWS_S3_EXPORTS_BUCKET = "liberialearn-exports-test";
    process.env.AWS_REGION = "us-east-1";
  });

  afterEach(() => {
    delete process.env.AWS_S3_EXPORTS_BUCKET;
  });

  it("uploadExport uploads to S3 and returns a signed URL", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    getSignedUrlMock.mockResolvedValue("https://signed.example/upload");

    const result = await uploadExport(
      "governance/report.csv",
      Buffer.from("hello"),
      "text/csv; charset=utf-8"
    );

    expect(result).toBe("https://signed.example/upload");
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
    expect(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input).toEqual(
      expect.objectContaining({
        Bucket: "liberialearn-exports-test",
        Key: "governance/report.csv",
        ContentType: "text/csv; charset=utf-8",
        ServerSideEncryption: "AES256",
      })
    );
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 900 }
    );
  });

  it("getExportSignedUrl signs an existing object", async () => {
    getSignedUrlMock.mockResolvedValue("https://signed.example/existing");

    const result = await getExportSignedUrl("governance/existing.csv");

    expect(result).toBe("https://signed.example/existing");
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(GetObjectCommand),
      { expiresIn: 900 }
    );
  });
});
