const test = require("node:test");
const assert = require("node:assert");
const { SQSClient, ReceiveMessageCommand } = require("@aws-sdk/client-sqs");

const API = process.env.API_URL || "http://localhost:3001";
const ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const QUEUE_URL = process.env.SQS_QUEUE_URL || `${ENDPOINT}/000000000000/ma-file-local`;

test("POST /api/contact envoie un message dans SQS", async () => {
  const form = new FormData();
  form.append("nom", "CI");
  form.append("email", "ci@example.com");
  form.append("message", "Test d'intégration");
  form.append("attachment", new Blob(["piece jointe CI"]), "ci.txt");

  const res = await fetch(`${API}/api/contact`, { method: "POST", body: form });
  assert.strictEqual(res.status, 201);
  const data = await res.json();

  const sqs = new SQSClient({
    region: "us-east-1",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  let found = false;
  for (let i = 0; i < 5 && !found; i++) {
    const out = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2,
        VisibilityTimeout: 0,
      })
    );
    found = (out.Messages || []).some((m) => JSON.parse(m.Body).id === data.id);
  }
  assert.ok(found, "le message du test n'a pas été trouvé dans SQS");
});
