-- CreateTable
CREATE TABLE "CertificateShare" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateShare_shareToken_key" ON "CertificateShare"("shareToken");

-- CreateIndex
CREATE INDEX "CertificateShare_certificateId_idx" ON "CertificateShare"("certificateId");

-- CreateIndex
CREATE INDEX "CertificateShare_sharedById_idx" ON "CertificateShare"("sharedById");

-- AddForeignKey
ALTER TABLE "CertificateShare" ADD CONSTRAINT "CertificateShare_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
