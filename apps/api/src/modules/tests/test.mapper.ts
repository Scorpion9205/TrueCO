import { TestResponseDto, TestResultResponseDto } from './dto/test.dto.js';

export class TestMapper {
  public static toResponseDto(entity: any): TestResponseDto {
    const totalMarks = Number(entity.totalMarks);
    const passingMarks = entity.passingMarks !== null && entity.passingMarks !== undefined
      ? Number(entity.passingMarks)
      : undefined;

    let results: TestResultResponseDto[] | undefined = undefined;
    let averageScore: number | undefined = undefined;
    let highestScore: number | undefined = undefined;

    if (Array.isArray(entity.results) && entity.results.length > 0) {
      const mappedResults: TestResultResponseDto[] = entity.results.map((r: any) => {
        const marksObtained = Number(r.marksObtained);
        const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 10000) / 100 : 0;
        const studentName = r.student
          ? `${r.student.firstName} ${r.student.lastName}`
          : 'Unknown Student';

        return {
          id: r.id,
          studentId: r.studentId,
          studentName,
          marksObtained,
          isAbsent: Boolean(r.isAbsent),
          percentage,
          remarks: r.remarks,
        };
      });

      const attended = mappedResults.filter((r) => !r.isAbsent);
      if (attended.length > 0) {
        const totalScore = attended.reduce((acc, r) => acc + r.marksObtained, 0);
        averageScore = Math.round((totalScore / attended.length) * 100) / 100;
        highestScore = Math.max(...attended.map((r) => r.marksObtained));
      }

      results = mappedResults;
    }

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      batchId: entity.batchId,
      title: entity.title,
      subject: entity.subject,
      testDate: new Date(entity.testDate),
      totalMarks,
      passingMarks,
      averageScore,
      highestScore,
      results,
      createdAt: entity.createdAt,
    };
  }
}
