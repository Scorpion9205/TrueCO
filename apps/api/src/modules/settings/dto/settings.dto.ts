export interface BrandingConfig {
  readonly logoUrl?: string;
  readonly primaryColor?: string;
  readonly headerText?: string;
}

export interface NotificationSettingsConfig {
  readonly whatsappEnabled?: boolean;
  readonly emailEnabled?: boolean;
  readonly defaultSenderName?: string;
}

export interface CoachingConfig {
  readonly branding?: BrandingConfig;
  readonly timezone?: string;
  readonly currency?: string;
  readonly academicYear?: string;
  readonly notifications?: NotificationSettingsConfig;
  readonly receiptPrefix?: string;
  readonly attendanceThreshold?: number; // e.g. 75 (%)
  readonly [key: string]: unknown;
}

export interface UpdateSettingsDto {
  readonly branding?: BrandingConfig;
  readonly timezone?: string;
  readonly currency?: string;
  readonly academicYear?: string;
  readonly notifications?: NotificationSettingsConfig;
  readonly receiptPrefix?: string;
  readonly attendanceThreshold?: number;
  readonly extraConfig?: Record<string, unknown>;
}

export interface SettingsResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly config: CoachingConfig;
  readonly updatedAt: Date;
}
