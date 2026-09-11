import { IImportRepository } from './import.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import {
  BulkImportDto,
  ImportResultDto,
  ImportRowError,
} from './dto/import.dto.js';
import {
  batchImportRowSchema,
  studentImportRowSchema,
  teacherImportRowSchema,
} from './validators/import.validator.js';
import { createBulkDataImportedEvent } from './import.events.js';

export class ImportService {
  public constructor(
    private readonly importRepository: IImportRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async importData(
    dto: BulkImportDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<ImportResultDto> {
    const errors: ImportRowError[] = [];
    const validRows: any[] = [];

    // 1. Row-by-row Zod validation
    for (let i = 0; i < dto.rows.length; i++) {
      const rowNumber = i + 1;
      const rawRow = dto.rows[i];

      try {
        let validated: any;
        if (dto.entityType === 'STUDENTS') {
          validated = studentImportRowSchema.parse(rawRow);
        } else if (dto.entityType === 'TEACHERS') {
          validated = teacherImportRowSchema.parse(rawRow);
        } else if (dto.entityType === 'BATCHES') {
          validated = batchImportRowSchema.parse(rawRow);
        }
        validRows.push(validated);
      } catch (err: any) {
        if (err.errors && Array.isArray(err.errors)) {
          for (const zErr of err.errors) {
            errors.push({
              rowNumber,
              field: zErr.path?.join('.'),
              message: zErr.message,
            });
          }
        } else {
          errors.push({
            rowNumber,
            message: err.message || 'Row validation failed',
          });
        }
      }
    }

    let importedIds: string[] = [];

    // 2. Persist valid rows if not a dry-run
    if (!dto.dryRun && validRows.length > 0) {
      if (dto.entityType === 'STUDENTS') {
        importedIds = await this.importRepository.importStudents(coachingId, validRows);
      } else if (dto.entityType === 'TEACHERS') {
        importedIds = await this.importRepository.importTeachers(coachingId, validRows);
      } else if (dto.entityType === 'BATCHES') {
        importedIds = await this.importRepository.importBatches(coachingId, validRows);
      }
    }

    const result: ImportResultDto = {
      entityType: dto.entityType,
      totalRows: dto.rows.length,
      successCount: validRows.length,
      errorCount: errors.length,
      errors,
      dryRun: dto.dryRun ?? false,
      importedIds,
    };

    // 3. Emit Domain Event
    await this.eventBus.publish(
      createBulkDataImportedEvent(
        {
          coachingId,
          entityType: dto.entityType,
          totalRows: dto.rows.length,
          successCount: validRows.length,
          errorCount: errors.length,
          dryRun: dto.dryRun ?? false,
        },
        correlationId,
        userId,
      ),
    );

    return result;
  }
}
