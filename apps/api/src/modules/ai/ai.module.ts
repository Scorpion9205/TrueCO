import { Router } from 'express';
import { PrismaAiRepository } from './ai.repository.js';
import { AiProviderFactory } from './providers/ai-provider.factory.js';
import { RedisPromptCache } from './cache/redis-prompt.cache.js';
import { eventBus } from '../../events/event-bus.js';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { createAiRouter } from './ai.routes.js';
import { AiSubscriber } from './ai.subscribers.js';
import { AiJobProducer } from './ai.jobs.js';
import { AiCron } from './ai.cron.js';

export class AiModule {
  public constructor(
    public readonly router: Router,
    public readonly service: AiService,
    public readonly subscriber: AiSubscriber,
    public readonly jobProducer: AiJobProducer,
    public readonly cron: AiCron,
  ) {}

  public static init(): AiModule {
    const repository = new PrismaAiRepository();
    const providerFactory = new AiProviderFactory();
    const promptCache = new RedisPromptCache();
    const service = new AiService(repository, providerFactory, promptCache, eventBus);
    const controller = new AiController(service);
    const router = createAiRouter(controller);

    const subscriber = new AiSubscriber(eventBus, service);
    subscriber.register();

    const jobProducer = new AiJobProducer();
    const cron = new AiCron();
    cron.register();

    return new AiModule(router, service, subscriber, jobProducer, cron);
  }
}
