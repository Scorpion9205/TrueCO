import { describe, it, expect, vi, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { envConfig } from '../../config/env.config.js';
import { SmtpEmailAdapter } from '../../modules/notifications/adapters/smtp-email.adapter.js';
import { MetaCloudWhatsAppAdapter } from '../../modules/notifications/adapters/meta-cloud-whatsapp.adapter.js';
import { EmailAuthMailer } from '../../modules/auth/auth.mailer.js';
import { IEmailAdapter, SendEmailInput } from '../../modules/notifications/adapters/email.adapter.interface.js';
import { GeminiEmbeddingAdapter } from '../../modules/ai/embeddings/gemini-embedding.adapter.js';
import { OpenAiEmbeddingAdapter } from '../../modules/ai/embeddings/openai-embedding.adapter.js';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';
import { ClaudeAiAdapter } from '../../modules/ai/providers/claude.adapter.js';
import { KnowledgeBaseService } from '../../modules/ai/rag/knowledge-base.service.js';
import { InMemoryKnowledgeBaseRepository } from '../fakes/in-memory-knowledge-base.repository.js';
import { getIntegrationStatus } from '../../common/integrations/integration-status.js';

function stubEnv(overrides: Record<string, unknown>): void {
  const realGet = envConfig.get.bind(envConfig);
  vi.spyOn(envConfig, 'get').mockImplementation(((key: string) =>
    key in overrides ? overrides[key] : realGet(key as any)) as any);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SMTP email adapter', () => {
  it('sends through the SMTP transport and returns its message id', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sent = vi.spyOn(transport, 'sendMail');
    const adapter = new SmtpEmailAdapter(transport);

    const result = await adapter.sendEmail({
      to: 'parent@example.com',
      subject: 'Fee receipt',
      htmlBody: '<p>Paid</p>',
      textBody: 'Paid',
      coachingId: 'c1',
    });

    expect(result.status).toBe('SENT');
    expect(result.providerMessageId).toBeTruthy();
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@example.com', subject: 'Fee receipt', html: '<p>Paid</p>', text: 'Paid' }),
    );
  });

  it('reports a failed send instead of claiming success', async () => {
    const transport = { sendMail: vi.fn().mockRejectedValue(new Error('connection refused')) } as any;
    const result = await new SmtpEmailAdapter(transport).sendEmail({ to: 'x@y.in', subject: 's', htmlBody: 'b', coachingId: 'c' });
    expect(result).toMatchObject({ status: 'FAILED', errorMessage: 'connection refused' });
  });

  it('fails in production when SMTP is not configured, and only simulates in development', async () => {
    const mail = { to: 'x@y.in', subject: 's', htmlBody: 'b', coachingId: 'c' };

    stubEnv({ NODE_ENV: 'production', SMTP_HOST: undefined });
    expect((await new SmtpEmailAdapter().sendEmail(mail)).status).toBe('FAILED');

    vi.restoreAllMocks();
    stubEnv({ NODE_ENV: 'development', SMTP_HOST: undefined });
    expect((await new SmtpEmailAdapter().sendEmail(mail)).status).toBe('SENT');
  });
});

describe('WhatsApp adapter', () => {
  it('fails in production when credentials are missing instead of reporting a fake send', async () => {
    stubEnv({ NODE_ENV: 'production', WHATSAPP_PHONE_NUMBER_ID: undefined, WHATSAPP_API_TOKEN: undefined });
    const result = await new MetaCloudWhatsAppAdapter().sendMessage({ to: '+919876543210', coachingId: 'c', bodyText: 'hi' });
    expect(result).toMatchObject({ status: 'FAILED', providerMessageId: '' });
  });
});

describe('Account emails', () => {
  class CapturingEmail implements IEmailAdapter {
    public sent: SendEmailInput[] = [];
    public async sendEmail(input: SendEmailInput) {
      this.sent.push(input);
      return { providerMessageId: 'm1', status: 'SENT' as const };
    }
  }

  it('emails a password reset link built from FRONTEND_URL with the token encoded', async () => {
    const email = new CapturingEmail();
    await new EmailAuthMailer(email, 'https://app.trueco.in').sendPasswordReset('owner@x.in', 'a+b/c=');

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe('owner@x.in');
    expect(email.sent[0].textBody).toContain('https://app.trueco.in/reset-password?token=a%2Bb%2Fc%3D');
    expect(email.sent[0].htmlBody).toContain('href="https://app.trueco.in/reset-password?token=a%2Bb%2Fc%3D"');
  });

  it('surfaces a failed delivery to the caller', async () => {
    const failing: IEmailAdapter = {
      sendEmail: async () => ({ providerMessageId: '', status: 'FAILED', errorMessage: 'not configured' }),
    };
    await expect(new EmailAuthMailer(failing, 'https://x').sendEmailVerification('a@b.in', 't')).rejects.toThrow(
      'not configured',
    );
  });
});

describe('Embedding providers', () => {
  const vector = (n: number) => Array.from({ length: n }, () => 0.01);

  it('Gemini sends the key in a header (never the URL) and requests 1536 dimensions natively', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embedding: { values: vector(1536) } }) });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new GeminiEmbeddingAdapter('secret-key', 'gemini-embedding-001');
    await adapter.generateEmbedding('fees policy');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('secret-key');
    expect(init.headers['x-goog-api-key']).toBe('secret-key');
    expect(JSON.parse(init.body).outputDimensionality).toBe(1536);
    expect(adapter.modelId).toBe('gemini:gemini-embedding-001');
  });

  it('rejects a wrongly sized vector instead of padding it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embedding: { values: vector(768) } }) }));
    await expect(new GeminiEmbeddingAdapter('k', 'm').generateEmbedding('x')).rejects.toThrow(/768-dimensional/);
  });

  it('refuses to embed without a key rather than silently switching to mock vectors', async () => {
    await expect(new OpenAiEmbeddingAdapter('', 'text-embedding-3-small').generateEmbeddings(['x'])).rejects.toThrow(
      'OPENAI_API_KEY is not configured',
    );
    await expect(new GeminiEmbeddingAdapter('', 'm').generateEmbedding('x')).rejects.toThrow('GEMINI_API_KEY is not configured');
  });

  it('only searches chunks embedded by the current model', async () => {
    const repo = new InMemoryKnowledgeBaseRepository();
    const eventBus = { publish: vi.fn(), publishBatch: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
    const coachingId = '11111111-1111-1111-1111-111111111111';
    const content = 'Fees are due on the 5th of every month.';

    const mock = new MockEmbeddingProvider();
    await new KnowledgeBaseService(repo as any, mock, eventBus as any).ingestDocument(
      { title: 'Fees', rawContent: content } as any,
      coachingId,
    );

    const sameModel = await new KnowledgeBaseService(repo as any, mock, eventBus as any).searchKnowledge(content, coachingId, 3, 0.1);
    expect(sameModel.length).toBeGreaterThan(0);

    // A different model produces incomparable vectors: its search must not see these chunks
    const otherModel = Object.assign(new MockEmbeddingProvider(), { modelId: 'openai:text-embedding-3-small' });
    const crossModel = await new KnowledgeBaseService(repo as any, otherModel, eventBus as any).searchKnowledge(content, coachingId, 3, 0.1);
    expect(crossModel).toEqual([]);
  });
});

describe('AI chat providers', () => {
  it('fail in production without a key instead of returning mock text that would be charged', async () => {
    stubEnv({ NODE_ENV: 'production' });
    await expect(new ClaudeAiAdapter('').generateCompletion({ prompt: 'hi' })).rejects.toThrow(
      'ANTHROPIC_API_KEY is not configured',
    );
  });

  it('use the configured model', async () => {
    stubEnv({ AI_MODEL_CLAUDE: 'claude-test-model' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'parent' }], usage: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ClaudeAiAdapter('key').generateCompletion({ prompt: 'hi' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('claude-test-model');
    expect(result.content).toBe('Hello parent');
  });
});

describe('Integration status report', () => {
  it('lists every integration with whether it is configured', () => {
    stubEnv({ SMTP_HOST: 'smtp.example.com', WHATSAPP_PHONE_NUMBER_ID: undefined });
    const status = getIntegrationStatus();
    expect(status.find((s) => s.name === 'Email (SMTP)')?.configured).toBe(true);
    expect(status.find((s) => s.name === 'WhatsApp (Meta Cloud API)')?.configured).toBe(false);
  });
});
