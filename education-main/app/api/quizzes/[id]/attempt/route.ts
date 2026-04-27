import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await getOrCreateStudent(session.user.id);
    if (!student) return NextResponse.json({ error: 'No department found. Please contact admin.' }, { status: 404 });

    const quiz = await db.quiz.findUnique({
      where: { id: params.id },
      include: { questions: true },
    });
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Check attempts count
    const existingAttempts = await db.quizAttempt.count({
      where: { quizId: params.id, studentId: student.id },
    });
    if (existingAttempts >= quiz.maxAttempts) {
      return NextResponse.json({ error: 'Max attempts reached' }, { status: 400 });
    }

    const body = await req.json();
    const { answers, timeSpent } = body;

    // Grade answers
    let score = 0;
    let maxScore = 0;
    const gradedAnswers: any[] = [];

    quiz.questions.forEach(question => {
      maxScore += question.points;
      const studentAnswer = answers?.[question.id] ?? null;

      // Support both index-based answers ("0","1") and text-based answers
      let isCorrect = false;
      if (studentAnswer !== null) {
        const studentAnswerStr = String(studentAnswer).trim();
        const correctAnswerStr = String(question.correctAnswer).trim();

        // Direct match (text answer or TRUE_FALSE)
        if (studentAnswerStr === correctAnswerStr) {
          isCorrect = true;
        }
        // Index-based match: student sent "0" and correctAnswer is the option text
        else if (!isNaN(Number(studentAnswerStr)) && question.options.length > 0) {
          const idx = Number(studentAnswerStr);
          const selectedOption = question.options[idx];
          if (selectedOption !== undefined && selectedOption.trim() === correctAnswerStr) {
            isCorrect = true;
          }
        }
        // correctAnswer is an index, student sent text
        else if (!isNaN(Number(correctAnswerStr)) && question.options.length > 0) {
          const idx = Number(correctAnswerStr);
          const correctOption = question.options[idx];
          if (correctOption !== undefined && correctOption.trim() === studentAnswerStr) {
            isCorrect = true;
          }
        }
      }

      if (isCorrect) score += question.points;

      // Resolve display text for student answer
      let displayStudentAnswer = studentAnswer;
      if (studentAnswer !== null && !isNaN(Number(studentAnswer)) && question.options.length > 0) {
        displayStudentAnswer = question.options[Number(studentAnswer)] ?? studentAnswer;
      }

      // Resolve display text for correct answer
      let displayCorrectAnswer = question.correctAnswer;
      if (!isNaN(Number(question.correctAnswer)) && question.options.length > 0) {
        displayCorrectAnswer = question.options[Number(question.correctAnswer)] ?? question.correctAnswer;
      }

      gradedAnswers.push({
        questionId: question.id,
        question: question.question,
        studentAnswer: displayStudentAnswer,
        correctAnswer: quiz.showCorrectAnswers ? displayCorrectAnswer : undefined,
        isCorrect,
        points: isCorrect ? question.points : 0,
        maxPoints: question.points,
        explanation: quiz.showCorrectAnswers ? question.explanation : undefined,
      });
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    const attempt = await db.quizAttempt.create({
      data: {
        quizId: params.id,
        studentId: student.id,
        score,
        maxScore,
        percentage,
        answers: gradedAnswers,
        timeSpent: timeSpent ?? null,
        completedAt: new Date(),
        status: 'COMPLETED',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        score,
        maxScore,
        percentage,
        passed: percentage >= quiz.passingScore,
        passingScore: quiz.passingScore,
        gradedAnswers,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}