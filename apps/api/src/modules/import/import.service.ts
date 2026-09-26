import { IImportRepository } from './import.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { BulkImportDto, ImportResultDto, ImportRowError } from './dto/import.dto.js';
import {
  BatchImportRow,
  batchImportRowSchema,
  StudentImportRow,
  studentImportRowSchema,
} from './validators/import.validator.js';
import { createBulkDataImportedEvent } from './import.events.js';

/**
 * Column headings people use in spreadsheets, mapped to import fields. Matching ignores case,
 * spaces, dots, dashes and underscores, so "Roll No.", "roll_no" and "RollNo" all work.
 */
const COLUMN_ALIASES: Record<string, string> = {
  firstname: 'firstName',
  lastname: 'lastName',
  surname: 'lastName',
  phone: 'phone',
  mobile: 'phone',
  studentphone: 'phone',
  email: 'email',
  rollno: 'rollNumber',
  rollnumber: 'rollNumber',
  gender: 'gender',
  dob: 'dob',
  dateofbirth: 'dob',
  birthdate: 'dob',
  joiningdate: 'joiningDate',
  parentname: 'parentName',
  parentphone: 'parentPhone',
  parentmobile: 'parentPhone',
  relation: 'parentRelation',
  parentrelation: 'parentRelation',
  batch: 'batchName',
  batchname: 'batchName',
  name: 'name',
  subject: 'subject',
  academicyear: 'academicYear',
  starttime: 'startTime',
  endtime: 'endTime',
  days: 'daysOfWeek',
  daysofweek: 'daysOfWeek',
};

export function normaliseColumns(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = COLUMN_ALIASES[key.toLowerCase().replace(/[\s._-]/g, '')];
    if (field && result[field] === undefined) result[field] = value;
  }
  return result;
}

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
    const students: StudentImportRow[] = [];
    const batches: BatchImportRow[] = [];
    // A row naming a batch that does not exist is reported, not quietly left unenrolled
    const batchIds =
      dto.entityType === 'STUDENTS' ? await this.importRepository.findBatchIdsByName(coachingId) : null;

    // 1. Row-by-row validation; rows with problems are reported and skipped
    dto.rows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const row = normaliseColumns(rawRow);
      const parsed =
        dto.entityType === 'STUDENTS'
          ? studentImportRowSchema.safeParse(row)
          : batchImportRowSchema.safeParse(row);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ rowNumber, field: issue.path.join('.'), message: issue.message });
        }
        return;
      }
      if (dto.entityType === 'STUDENTS') {
        const student = parsed.data as StudentImportRow;
        if (student.batchName && !batchIds!.has(student.batchName.toLowerCase().trim())) {
          errors.push({
            rowNumber,
            field: 'batchName',
            message: `No active batch called "${student.batchName}"`,
          });
          return;
        }
        students.push(student);
      } else {
        batches.push(parsed.data as BatchImportRow);
      }
    });

    // 2. Persist the valid rows together (all or nothing), unless this is a dry run
    const validCount = students.length + batches.length;
    let importedIds: string[] = [];
    if (!dto.dryRun && validCount > 0) {
      importedIds =
        dto.entityType === 'STUDENTS'
          ? await this.importRepository.importStudents(coachingId, students)
          : await this.importRepository.importBatches(coachingId, batches);
    }

    const result: ImportResultDto = {
      entityType: dto.entityType,
      totalRows: dto.rows.length,
      successCount: validCount,
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
          successCount: validCount,
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
