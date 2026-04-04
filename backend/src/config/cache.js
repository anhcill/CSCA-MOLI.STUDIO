/**
 * In-Memory Cache Module (zero dependencies)
 * Dùng Map với TTL để cache các API response tĩnh / ít thay đổi
 */

class SimpleCache {
    constructor() {
        this.store = new Map();
    }

    /**
     * Lấy giá trị từ cache
     * @param {string} key
     * @returns {any|null} - null nếu không tìm thấy hoặc đã hết TTL
     */
    get(key) {
        const item = this.store.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Lưu giá trị vào cache
     * @param {string} key
     * @param {any} value
     * @param {number} ttlSeconds - Thời gian sống (giây)
     */
    set(key, value, ttlSeconds = 300) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }

    /**
     * Xóa một key khỏi cache
     * @param {string} key
     */
    del(key) {
        this.store.delete(key);
    }

    /**
     * Xóa tất cả keys bắt đầu bằng prefix
     * @param {string} prefix
     */
    delByPrefix(prefix) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Xóa toàn bộ cache
     */
    flush() {
        this.store.clear();
    }

    /**
     * Số lượng keys đang có trong cache
     */
    size() {
        return this.store.size;
    }
}

// Singleton instance dùng chung toàn app
const cache = new SimpleCache();

// TTL presets (giây)
const TTL = {
    SHORT: 60,        // 1 phút  - dữ liệu thay đổi thường xuyên
    MEDIUM: 5 * 60,   // 5 phút  - danh sách đề thi
    LONG: 10 * 60,    // 10 phút - từ vựng, tài liệu
    VERY_LONG: 30 * 60, // 30 phút - dữ liệu gần tĩnh
};

module.exports = { cache, TTL };
