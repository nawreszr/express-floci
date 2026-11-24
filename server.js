const express = require("express");
const multer = require("multer");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const BUCKET = process.env.S3_BUCKET || "mon-bucket-local";
const QUEUE_URL =
  process.env.SQS_QUEUE_URL || `${ENDPOINT}/000000000000/ma-file-local`;

const awsConfig = {
  region: "us-east-1",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};

const sqs = new SQSClient(awsConfig);
const s3 = new S3Client({ ...awsConfig, forcePathStyle: true });

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/contact", upload.single("attachment"), async (req, res) => {
  try {
    const { nom, email, message } = req.body;
    if (!nom || !email || !message) {
      return res.status(400).json({ error: "nom, email et message sont requis" });
    }

    const id = crypto.randomUUID();
    let attachmentKey = null;

    if (req.file) {
      attachmentKey = `contacts/${id}/${req.file.originalname}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: attachmentKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({ id, nom, email, message, attachmentKey }),
      })
    );

    res.status(201).json({ id, status: "envoyé", attachmentKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
