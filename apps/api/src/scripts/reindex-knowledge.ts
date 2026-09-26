/**
 * Embeds every knowledge-base document that has no chunks from the configured embedding model:
 * documents added while no model was set up, or embedded by a model since replaced. Run once
 * after setting OPENAI_API_KEY or GEMINI_API_KEY (or changing the embedding model):
 *
 *   pnpm --filter @vargly/api kb:reindex          (from a built API: node dist/scripts/...)
 */
import { RequestContextService } from '../common/services/request-context.service.js';
import { getPrismaClient } from '../database/prisma/tenant-prisma.extension.js';
import { EmbeddingProviderFactory } from '../modules/ai/embeddings/embedding-provider.factory.js';
import { PrismaKnowledgeBaseRepository } from '../modules/ai/rag/knowledge-base.repository.js';
import { KnowledgeBaseService } from '../modules/ai/rag/knowledge-base.service.js';

const noEvents = { publish: async () => undefined, subscribe: () => undefined } as any;

async function main(): Promise<void> {
  const provider = EmbeddingProviderFactory.getInstance().getProvider();
  const service = new KnowledgeBaseService(new PrismaKnowledgeBaseRepository(), provider, noEvents);
  console.log(`Embedding model: ${provider.modelId}`);
  // Documents of every institute are covered, so this runs outside any one tenant
  const indexed = await RequestContextService.runAsSystem('kb:reindex', () =>
    service.reindexPending(),
  );
  console.log(`Indexed ${indexed} document(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => (getPrismaClient() as any).$disconnect());
