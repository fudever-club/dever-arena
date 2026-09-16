/**
 * DEVER-Forces Contest State Machine
 * Quản lý vòng đời và các quy tắc kiểm soát hành động trong từng phase thi đấu.
 */

export const CONTEST_PHASES = {
  REGISTRATION: 'REGISTRATION',
  CODING: 'CODING',
  HACK_PHASE: 'HACK_PHASE',
  SYSTEM_TESTING: 'SYSTEM_TESTING',
  FINISHED: 'FINISHED'
};

export class ContestManager {
  /**
   * @param {object} config 
   * @param {string} config.id
   * @param {string} config.title
   * @param {number} config.codingDurationMinutes - Thường là 120 phút
   * @param {number} config.hackDurationMinutes - Thường là 15 hoặc 20 phút
   */
  constructor({ id, title, codingDurationMinutes = 120, hackDurationMinutes = 15 }) {
    this.id = id;
    this.title = title;
    this.codingDurationMinutes = codingDurationMinutes;
    this.hackDurationMinutes = hackDurationMinutes;
    this.currentPhase = CONTEST_PHASES.REGISTRATION;
    this.registeredUsers = new Set();
    this.rooms = new Map(); // roomId -> Set of userIds
    this.submissions = []; // Danh sách toàn bộ bài nộp
    this.hackEvents = [];  // Danh sách các lượt hack
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
    this.distributeRooms(25); // 25 người mỗi phòng
  }

  startHackPhase() {
    if (this.currentPhase !== CONTEST_PHASES.CODING) {
      throw new Error('Chỉ có thể chuyển sang Hack Phase sau khi hết giờ Coding.');
    }
    this.currentPhase = CONTEST_PHASES.HACK_PHASE;
  }

  startSystemTesting() {
    if (this.currentPhase !== CONTEST_PHASES.HACK_PHASE) {
      throw new Error('Chỉ có thể chạy System Testing sau khi kết thúc Hack Phase.');
    }
    this.currentPhase = CONTEST_PHASES.SYSTEM_TESTING;
  }

  finishContest() {
    if (this.currentPhase !== CONTEST_PHASES.SYSTEM_TESTING) {
      throw new Error('Chỉ có thể kết thúc contest sau khi hoàn tất System Testing.');
    }
    this.currentPhase = CONTEST_PHASES.FINISHED;
  }

  distributeRooms(maxPerRoom = 25) {
    const userList = Array.from(this.registeredUsers);
    let roomIndex = 1;
    for (let i = 0; i < userList.length; i += maxPerRoom) {
      const roomId = `Room #${roomIndex++}`;
      const chunk = new Set(userList.slice(i, i + maxPerRoom));
      this.rooms.set(roomId, chunk);
    }
  }

  getRoomForUser(userId) {
    for (const [roomId, members] of this.rooms.entries()) {
      if (members.has(userId)) return roomId;
    }
    return null;
  }

  canSubmitSolution() {
    return this.currentPhase === CONTEST_PHASES.CODING;
  }

  canPerformHack(hackerId, targetUserId) {
    if (this.currentPhase !== CONTEST_PHASES.HACK_PHASE) {
      return { allowed: false, reason: 'Chỉ được phép hack trong Hack Phase (sau khi kết thúc làm bài).' };
    }
    if (hackerId === targetUserId) {
      return { allowed: false, reason: 'Không thể tự hack bài của chính mình.' };
    }
    const hackerRoom = this.getRoomForUser(hackerId);
    const targetRoom = this.getRoomForUser(targetUserId);
    if (!hackerRoom || hackerRoom !== targetRoom) {
      return { allowed: false, reason: 'Chỉ được phép hack các đối thủ trong cùng một Room.' };
    }
    return { allowed: true };
  }

  canViewSourceCode(viewerId, targetUserId) {
    // Trong phase Hack: được xem code của người cùng Room
    if (this.currentPhase === CONTEST_PHASES.HACK_PHASE) {
      return this.getRoomForUser(viewerId) === this.getRoomForUser(targetUserId);
    }
    // Khi contest kết thúc: ai cũng được xem tất cả code (upsolving)
    if (this.currentPhase === CONTEST_PHASES.FINISHED) {
      return true;
    }
    // Trong lúc thi: cấm tuyệt đối xem code người khác
    return viewerId === targetUserId;
  }
}
