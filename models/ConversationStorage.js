/**
 * 대화 저장소 (Firebase Firestore 기반)
 * 세션 및 대화 내역 영구 저장
 */

const admin = require('firebase-admin');

class ConversationStorage {
  constructor(firestoreDb = null) {
    this.db = firestoreDb || admin.firestore();
    this.sessionsCollection = 'chat_sessions';
    this.messagesCollection = 'chat_messages';
  }

  /**
   * 세션 저장
   * @param {Object} session
   * @returns {Promise<void>}
   */
  async saveSession(session) {
    try {
      await this.db.collection(this.sessionsCollection).doc(session.sessionId).set({
        sessionId: session.sessionId,
        userId: session.userId,
        stage: session.stage,
        category: session.category,
        context: session.context,
        metadata: session.metadata,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('세션 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 세션 업데이트
   * @param {string} sessionId
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  async updateSession(sessionId, updates) {
    try {
      await this.db.collection(this.sessionsCollection).doc(sessionId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('세션 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 세션 조회
   * @param {string} sessionId
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
    try {
      const doc = await this.db.collection(this.sessionsCollection).doc(sessionId).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data();
    } catch (error) {
      console.error('세션 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 메시지 저장
   * @param {string} sessionId
   * @param {Object} message
   * @returns {Promise<string>} 메시지 ID
   */
  async saveMessage(sessionId, message) {
    try {
      const docRef = await this.db.collection(this.messagesCollection).add({
        sessionId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        metadata: message.metadata || {}
      });
      return docRef.id;
    } catch (error) {
      console.error('메시지 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 세션의 모든 메시지 조회
   * @param {string} sessionId
   * @param {number} limit - 최대 메시지 수 (기본값: 100)
   * @returns {Promise<Array>}
   */
  async getMessages(sessionId, limit = 100) {
    try {
      const snapshot = await this.db.collection(this.messagesCollection)
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'asc')
        .limit(limit)
        .get();

      const messages = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      return messages;
    } catch (error) {
      console.error('메시지 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자의 모든 세션 조회
   * @param {string} userId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getUserSessions(userId, limit = 20) {
    try {
      const snapshot = await this.db.collection(this.sessionsCollection)
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      const sessions = [];
      snapshot.forEach(doc => {
        sessions.push(doc.data());
      });
      return sessions;
    } catch (error) {
      console.error('사용자 세션 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 세션 삭제
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    try {
      // 세션 삭제
      await this.db.collection(this.sessionsCollection).doc(sessionId).delete();

      // 관련 메시지 삭제
      const messagesSnapshot = await this.db.collection(this.messagesCollection)
        .where('sessionId', '==', sessionId)
        .get();

      const batch = this.db.batch();
      messagesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('세션 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 오래된 세션 정리 (30일 이상)
   * @returns {Promise<number>} 삭제된 세션 수
   */
  async cleanupOldSessions() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshot = await this.db.collection(this.sessionsCollection)
        .where('updatedAt', '<', thirtyDaysAgo)
        .get();

      let count = 0;
      for (const doc of snapshot.docs) {
        await this.deleteSession(doc.id);
        count++;
      }

      return count;
    } catch (error) {
      console.error('세션 정리 오류:', error);
      throw error;
    }
  }

  /**
   * 통계 조회
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    try {
      const sessionsSnapshot = await this.db.collection(this.sessionsCollection).get();
      const messagesSnapshot = await this.db.collection(this.messagesCollection).get();

      const categoryCount = {};
      sessionsSnapshot.forEach(doc => {
        const category = doc.data().category;
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      });

      return {
        totalSessions: sessionsSnapshot.size,
        totalMessages: messagesSnapshot.size,
        categoryDistribution: categoryCount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('통계 조회 오류:', error);
      throw error;
    }
  }
}

module.exports = ConversationStorage;
