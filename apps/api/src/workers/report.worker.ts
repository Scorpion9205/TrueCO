import ExcelJS from 'exceljs';
import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { IStorageService } from '../common/storage/storage.interface.js';
import { MockStorageService } from '../common/storage/mock-storage.service.js';
import { logger } from '../common/logger/logger.service.js';

export interface ReportJobPayload {
  readonly coachingId: string;
  readonly reportType: 'ATTENDANCE' | 'FEES' | 'PROFIT_LOSS';
  readonly filter: Record<string, unknown>;
  readonly requestedBy?: string;
  readonly rows?: any[];
}

export interface ReportJobResult {
  readonly status: 'COMPLETED' | 'FAILED';
  readonly reportUrl: string;
  readonly fileKey: string;
  readonly format: 'xlsx';
  readonly rowCount: number;
  readonly completedAt: string;
}

export class ReportWorker {
  private worker: Worker | null = null;
  private readonly storageService: IStorageService;

  public constructor(storageService?: IStorageService) {
    this.storageService = storageService || new MockStorageService();
  }

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.REPORT,
      async (job: Job<ReportJobPayload>): Promise<ReportJobResult> => {
        logger.info(
          `[ReportWorker] Compiling ${job.data.reportType} report for coaching ${job.data.coachingId}`,
        );
        return this.processJob(job.data);
      },
      {
        connection: redis,
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[ReportWorker] Report Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[ReportWorker] Report Job ${job?.id} failed:`, err);
    });

    logger.info('[ReportWorker] Worker started listening to report-queue');
    return this.worker;
  }

  public async processJob(payload: ReportJobPayload): Promise<ReportJobResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TrueCO Analytics Engine';
    workbook.created = new Date();

    let rowCount = 0;

    switch (payload.reportType) {
      case 'ATTENDANCE':
        rowCount = this.buildAttendanceSheet(workbook, payload);
        break;
      case 'FEES':
        rowCount = this.buildFeesSheet(workbook, payload);
        break;
      case 'PROFIT_LOSS':
        rowCount = this.buildProfitLossSheet(workbook, payload);
        break;
      default:
        rowCount = this.buildGenericSheet(workbook, payload);
        break;
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `${payload.reportType.toLowerCase()}-report-${Date.now()}.xlsx`;

    const uploadResult = await this.storageService.uploadFile({
      coachingId: payload.coachingId,
      fileBuffer: buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      category: 'report',
    });

    logger.info(
      `[ReportWorker] Generated ${payload.reportType} Excel report (${rowCount} rows) at ${uploadResult.fileUrl}`,
    );

    return {
      status: 'COMPLETED',
      reportUrl: uploadResult.fileUrl,
      fileKey: uploadResult.fileKey,
      format: 'xlsx',
      rowCount,
      completedAt: new Date().toISOString(),
    };
  }

  private buildAttendanceSheet(workbook: ExcelJS.Workbook, payload: ReportJobPayload): number {
    const sheet = workbook.addWorksheet('Attendance Rollup');

    sheet.columns = [
      { header: 'Student ID', key: 'studentId', width: 25 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Batch', key: 'batchName', width: 20 },
      { header: 'Total Sessions', key: 'totalSessions', width: 16 },
      { header: 'Present', key: 'present', width: 14 },
      { header: 'Absent', key: 'absent', width: 14 },
      { header: 'Attendance Rate', key: 'rate', width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };

    const rows = payload.rows || [
      {
        studentId: 'STU-001',
        studentName: 'Sample Student 1',
        batchName: 'Physics Batch A',
        totalSessions: 20,
        present: 18,
        absent: 2,
        rate: '90%',
      },
      {
        studentId: 'STU-002',
        studentName: 'Sample Student 2',
        batchName: 'Physics Batch A',
        totalSessions: 20,
        present: 15,
        absent: 5,
        rate: '75%',
      },
    ];

    for (const r of rows) {
      sheet.addRow(r);
    }

    return rows.length;
  }

  private buildFeesSheet(workbook: ExcelJS.Workbook, payload: ReportJobPayload): number {
    const sheet = workbook.addWorksheet('Fee Collections');

    sheet.columns = [
      { header: 'Receipt No', key: 'receiptNumber', width: 20 },
      { header: 'Student ID', key: 'studentId', width: 20 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Amount (INR)', key: 'amount', width: 16 },
      { header: 'Payment Mode', key: 'paymentMode', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Paid At', key: 'paidAt', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };

    const rows = payload.rows || [
      {
        receiptNumber: 'REC-1001',
        studentId: 'STU-001',
        studentName: 'Sample Student 1',
        amount: 5000,
        paymentMode: 'UPI',
        status: 'PAID',
        paidAt: new Date().toISOString(),
      },
    ];

    for (const r of rows) {
      sheet.addRow(r);
    }

    return rows.length;
  }

  private buildProfitLossSheet(workbook: ExcelJS.Workbook, _payload: ReportJobPayload): number {
    const sheet = workbook.addWorksheet('P&L Statement');

    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Amount (INR)', key: 'amount', width: 20 },
      { header: 'Notes', key: 'notes', width: 35 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };

    const rows = [
      { metric: 'Total Fee Revenue Collected', amount: 150000, notes: 'From active students' },
      { metric: 'Total Faculty Salaries Paid', amount: 65000, notes: 'Disbursed teacher payroll' },
      { metric: 'Operational Expenses', amount: 15000, notes: 'Utilities, resources & rent' },
      { metric: 'Net Operating Profit', amount: 70000, notes: 'Gross Revenue - Expenses' },
    ];

    for (const r of rows) {
      sheet.addRow(r);
    }

    return rows.length;
  }

  private buildGenericSheet(workbook: ExcelJS.Workbook, payload: ReportJobPayload): number {
    const sheet = workbook.addWorksheet('Data Report');
    sheet.addRow(['Report Type', payload.reportType]);
    sheet.addRow(['Coaching ID', payload.coachingId]);
    sheet.addRow(['Generated At', new Date().toISOString()]);
    return 3;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
