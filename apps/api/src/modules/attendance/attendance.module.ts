import { Router } from 'express';
import { PrismaAttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceController } from './attendance.controller.js';
import { createAttendanceRoutes } from './attendance.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { AttendanceSubscribers } from './attendance.subscribers.js';

export class AttendanceModule {
  public static init(): { router: Router; service: AttendanceService } {
    const repository = new PrismaAttendanceRepository();
    const service = new AttendanceService(repository, eventBus);
    const controller = new AttendanceController(service);
    const router = createAttendanceRoutes(controller);

    AttendanceSubscribers.register(eventBus);

    return { router, service };
  }
}
