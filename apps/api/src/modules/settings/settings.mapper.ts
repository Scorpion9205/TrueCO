import { SettingsResponseDto } from './dto/settings.dto.js';

export class SettingsMapper {
  public static toResponseDto(entity: any): SettingsResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      config: (typeof entity.config === 'object' && entity.config !== null ? entity.config : {}) as any,
      updatedAt: new Date(entity.updatedAt),
    };
  }
}
