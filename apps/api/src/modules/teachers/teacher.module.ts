import { permissionResolver } from '../../common/security/permission-resolver.service.js';
import { Router } from 'express';
import { PrismaTeacherRepository } from './teacher.repository.js';
import { TeacherService } from './teacher.service.js';
import { TeacherController } from './teacher.controller.js';
import { createTeacherRoutes } from './teacher.routes.js';
import { passwordService } from '../../common/security/password.service.js';
import { eventBus } from '../../events/event-bus.js';
import { TeacherSubscribers } from './teacher.subscribers.js';

export class TeacherModule {
  public static init(): { router: Router; service: TeacherService } {
    const repository = new PrismaTeacherRepository();
    const service = new TeacherService(repository, passwordService, eventBus, permissionResolver);
    const controller = new TeacherController(service);
    const router = createTeacherRoutes(controller);

    TeacherSubscribers.register(eventBus);

    return { router, service };
  }
}
