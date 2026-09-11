import { Router } from 'express';
import { PrismaStudentRepository } from './student.repository.js';
import { StudentService } from './student.service.js';
import { StudentController } from './student.controller.js';
import { createStudentRoutes } from './student.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { StudentSubscribers } from './student.subscribers.js';

export class StudentModule {
  public static init(): { router: Router; service: StudentService } {
    const repository = new PrismaStudentRepository();
    const service = new StudentService(repository, eventBus);
    const controller = new StudentController(service);
    const router = createStudentRoutes(controller);

    StudentSubscribers.register(eventBus);

    return { router, service };
  }
}
