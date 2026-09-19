import PDFDocument from 'pdfkit';
import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { IStorageService } from '../common/storage/storage.interface.js';
import { MockStorageService } from '../common/storage/mock-storage.service.js';
import { logger } from '../common/logger/logger.service.js';

export interface PdfJobPayload {
  readonly coachingId: string;
  readonly type: 'FEE_RECEIPT' | 'STUDENT_REPORT' | 'SALARY_SLIP';
  readonly referenceId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PdfJobResult {
  readonly status: 'GENERATED' | 'FAILED';
  readonly documentUrl: string;
  readonly fileKey: string;
  readonly sizeBytes: number;
}

export class PdfWorker {
  private worker: Worker | null = null;
  private readonly storageService: IStorageService;

  public constructor(storageService?: IStorageService) {
    this.storageService = storageService || new MockStorageService();
  }

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.PDF,
      async (job: Job<PdfJobPayload>): Promise<PdfJobResult> => {
        logger.info(`[PdfWorker] Generating PDF for ${job.data.type} (ref: ${job.data.referenceId})`);
        return this.processJob(job.data);
      },
      {
        connection: redis,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[PdfWorker] PDF Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[PdfWorker] PDF Job ${job?.id} failed:`, err);
    });

    logger.info('[PdfWorker] Worker started listening to pdf-queue');
    return this.worker;
  }

  public async processJob(payload: PdfJobPayload): Promise<PdfJobResult> {
    const pdfBuffer = await this.renderPdfBuffer(payload);
    const fileName = `${payload.type.toLowerCase()}-${payload.referenceId}.pdf`;

    const categoryMap: Record<PdfJobPayload['type'], 'receipt' | 'report' | 'general'> = {
      FEE_RECEIPT: 'receipt',
      STUDENT_REPORT: 'report',
      SALARY_SLIP: 'general',
    };

    const uploadResult = await this.storageService.uploadFile({
      coachingId: payload.coachingId,
      fileBuffer: pdfBuffer,
      fileName,
      mimeType: 'application/pdf',
      category: categoryMap[payload.type] || 'general',
    });

    logger.info(`[PdfWorker] Generated & uploaded PDF to ${uploadResult.fileUrl} (${uploadResult.sizeBytes} bytes)`);

    return {
      status: 'GENERATED',
      documentUrl: uploadResult.fileUrl,
      fileKey: uploadResult.fileKey,
      sizeBytes: uploadResult.sizeBytes,
    };
  }

  public renderPdfBuffer(payload: PdfJobPayload): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      try {
        switch (payload.type) {
          case 'FEE_RECEIPT':
            this.drawFeeReceipt(doc, payload);
            break;
          case 'STUDENT_REPORT':
            this.drawStudentReport(doc, payload);
            break;
          case 'SALARY_SLIP':
            this.drawSalarySlip(doc, payload);
            break;
          default:
            this.drawGenericDocument(doc, payload);
            break;
        }
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private drawFeeReceipt(doc: PDFKit.PDFDocument, payload: PdfJobPayload): void {
    const meta = payload.metadata || {};
    const coachingName = String(meta.coachingName || 'TrueCO Partner Institute');
    const receiptNumber = String(meta.receiptNumber || payload.referenceId);
    const studentName = String(meta.studentName || 'Student');
    const rollNumber = String(meta.rollNumber || 'N/A');
    const amount = Number(meta.amount || 0);
    const paymentMethod = String(meta.paymentMethod || 'UPI / Online');
    const dateStr = meta.paidAt ? new Date(String(meta.paidAt)).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    const balance = meta.remainingBalance !== undefined ? `₹${meta.remainingBalance}` : '₹0.00';

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(coachingName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Official Fee Receipt & Payment Acknowledgment', { align: 'center' });
    doc.moveDown(0.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1);

    // Receipt Meta Box
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B');
    doc.text(`Receipt No: ${receiptNumber}`, 50, doc.y);
    doc.text(`Date: ${dateStr}`, 400, doc.y - 12);
    doc.moveDown(0.8);

    doc.font('Helvetica').fillColor('#334155');
    doc.text(`Student Name: ${studentName}`);
    doc.text(`Roll Number:  ${rollNumber}`);
    doc.text(`Payment Mode: ${paymentMethod}`);
    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 24).fill('#F1F5F9');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10);
    doc.text('Description / Particulars', 60, tableTop + 6);
    doc.text('Amount (INR)', 440, tableTop + 6, { width: 95, align: 'right' });

    // Table Row
    const rowTop = tableTop + 28;
    doc.font('Helvetica').fillColor('#334155');
    doc.text('Tuition Fee / Course Installment Payment', 60, rowTop);
    doc.text(`₹${amount.toLocaleString('en-IN')}`, 440, rowTop, { width: 95, align: 'right' });

    // Total Box
    const totalTop = rowTop + 30;
    doc.moveTo(50, totalTop).lineTo(545, totalTop).strokeColor('#CBD5E1').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A');
    doc.text('Total Paid:', 320, totalTop + 8);
    doc.text(`₹${amount.toLocaleString('en-IN')}`, 440, totalTop + 8, { width: 95, align: 'right' });

    doc.fontSize(9).font('Helvetica').fillColor('#64748B');
    doc.text(`Remaining Balance: ${balance}`, 320, totalTop + 24);

    // Footer
    doc.moveDown(5);
    doc.fontSize(8).fillColor('#94A3B8');
    doc.text('This is an electronically generated receipt verified by TrueCO Coaching ERP.', 50, doc.y, { align: 'center' });
    doc.text('No signature is required. For inquiries, contact institute administration.', { align: 'center' });
  }

  private drawStudentReport(doc: PDFKit.PDFDocument, payload: PdfJobPayload): void {
    const meta = payload.metadata || {};
    const coachingName = String(meta.coachingName || 'TrueCO Partner Institute');
    const studentName = String(meta.studentName || 'Student');
    const rollNumber = String(meta.rollNumber || 'N/A');
    const batchName = String(meta.batchName || 'General Batch');
    const attendancePct = meta.attendancePercentage !== undefined ? `${meta.attendancePercentage}%` : 'N/A';
    const testScoreAvg = meta.averageTestScore !== undefined ? `${meta.averageTestScore}%` : 'N/A';

    doc.fontSize(18).font('Helvetica-Bold').text(coachingName, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Student Academic & Attendance Performance Report', { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#059669').lineWidth(2).stroke();
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica').fillColor('#1E293B');
    doc.text(`Student: ${studentName}  |  Roll No: ${rollNumber}  |  Batch: ${batchName}`);
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    // Performance Metrics
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text('Performance Summary');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica').fillColor('#334155');
    doc.text(`Overall Attendance Rate: ${attendancePct}`);
    doc.text(`Average Assessment Score: ${testScoreAvg}`);
    doc.text(`Risk Status: ${meta.riskLevel || 'NORMAL'}`);
    doc.moveDown(2);

    doc.fontSize(8).fillColor('#94A3B8').text('Generated by TrueCO Education Analytics Engine.', { align: 'center' });
  }

  private drawSalarySlip(doc: PDFKit.PDFDocument, payload: PdfJobPayload): void {
    const meta = payload.metadata || {};
    const teacherName = String(meta.teacherName || 'Faculty Member');
    const month = String(meta.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    const baseSalary = Number(meta.baseSalary || meta.amount || 0);

    doc.fontSize(18).font('Helvetica-Bold').text('TrueCO Faculty Salary Slip', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Pay Period: ${month}`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#4F46E5').lineWidth(2).stroke();
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica').text(`Employee / Teacher: ${teacherName}`);
    doc.text(`Disbursal Reference: ${payload.referenceId}`);
    doc.text(`Net Salary Disbursed: ₹${baseSalary.toLocaleString('en-IN')}`);
    doc.moveDown(2);

    doc.fontSize(8).fillColor('#94A3B8').text('Confidential salary statement generated electronically.', { align: 'center' });
  }

  private drawGenericDocument(doc: PDFKit.PDFDocument, payload: PdfJobPayload): void {
    doc.fontSize(16).font('Helvetica-Bold').text(`TrueCO Document - ${payload.type}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica').text(`Coaching ID: ${payload.coachingId}`);
    doc.text(`Reference ID: ${payload.referenceId}`);
    doc.text(`Generated At: ${new Date().toISOString()}`);
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
