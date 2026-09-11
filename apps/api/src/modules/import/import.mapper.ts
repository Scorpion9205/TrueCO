import { ImportResultDto } from './dto/import.dto.js';

export class ImportMapper {
  public static toResultDto(data: ImportResultDto): ImportResultDto {
    return {
      entityType: data.entityType,
      totalRows: data.totalRows,
      successCount: data.successCount,
      errorCount: data.errorCount,
      errors: data.errors,
      dryRun: data.dryRun,
      importedIds: data.importedIds,
    };
  }
}
