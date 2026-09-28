/**
 * DEVER Arena Contest State Machine (chuẩn thi đấu quốc tế — ICPC/AtCoder style)
 * Vòng đời 3 phase nghiêm ngặt: REGISTRATION ➔ CODING ➔ FINISHED.
 * - Bài nộp được chấm trên toàn bộ test suite ngay khi nộp (verdict cuối cùng, không pretest).
 * - Freeze bảng điểm là cửa sổ cuối của CODING (quản lý bởi contestResults.js), không phải phase riêng.
 * - Không còn Hack Phase / System Testing / phân phòng (ADR-005).
 */

export const CONTEST_PHASES = {
  REGISTRATION: 'REGISTRATION',
  CODING: 'CODING',
  FINISHED: 'FINISHED'
};

export const PHASE_ORDER = ['REGISTRATION', 'CODING', 'FINISHED'];

export class ContestManager {
  /**
   * @param {object} config
   * @param {string} config.id
   * @param {string} config.title
   * @param {number} config.codingDurationMinutes - Thời lượng làm bài (phút)
   */
  constructor({ id, title, codingDurationMinutes = 120 }) {
    this.id = id;
    this.title = title;
    this.codingDurationMinutes = codingDurationMinutes;
    this.currentPhase = CONTEST_PHASES.REGISTRATION;
    this.registeredUsers = new Set();
    this.submissions = []; // Danh sách toàn bộ bài nộp
  }

  registerUser(userId) {
    if (this.currentPhase !== CONTEST_PHASES.REGISTRATION) {
      throw new Error(`Chỉ có thể đăng ký khi contest đang ở giai đoạn ${CONTEST_PHASES.REGISTRATION}.`);
    }
    this.registeredUsers.add(userId);
  }

  startCodingPhase() {
    if (this.currentPhase !== CONTEST_PHASES.REGISTRATION) {
      throw new Error('Chỉ có thể bắt đầu Coding Phase từ Registration.');
    }
    this.currentPhase = CONTEST_PHASES.CODING;
  }

  finishContest() {
    if (this.currentPhase !== CONTEST_PHASES.CODING) {
      throw new Error('Chỉ có thể kết thúc contest khi đang ở Coding Phase.');
    }
    this.currentPhase = CONTEST_PHASES.FINISHED;
  }

  canSubmitSolution() {
    return this.currentPhase === CONTEST_PHASES.CODING;
  }

  canViewSourceCode(viewerId, targetUserId) {
    // Khi contest kết thúc: ai cũng được xem tất cả code (upsolving)
    if (this.currentPhase === CONTEST_PHASES.FINISHED) {
      return true;
    }
    // Trong lúc thi: cấm tuyệt đối xem code người khác
    return viewerId === targetUserId;
  }
}
