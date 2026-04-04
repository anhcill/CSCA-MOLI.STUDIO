const bcrypt = require('bcrypt');

// Function to hash a password
async function hashPassword(password) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`\nPassword: ${password}`);
    console.log(`Hash: ${hash}\n`);
    return hash;
}

// Function to verify a password against a hash
async function verifyPassword(password, hash) {
    const isMatch = await bcrypt.compare(password, hash);
    console.log(`\nPassword: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log(`Match: ${isMatch ? '✅ YES' : '❌ NO'}\n`);
    return isMatch;
}

// Main function
async function main() {
    console.log('=== Password Hash Generator ===\n');

    // Generate hashes for common passwords
    await hashPassword('admin123');
    await hashPassword('password123');
    await hashPassword('28072003');

    // Test verification
    const testHash = '$2b$10$rH5C8X7qF3LxK3z6kZvYXeJ8KqL0F3LxK3z6kZvYXeJ8KqL0F3Lx';
    console.log('=== Testing Hash Verification ===');
    await verifyPassword('admin123', testHash);
    await verifyPassword('password123', testHash);
    await verifyPassword('28072003', testHash);
}

main().catch(console.error);
