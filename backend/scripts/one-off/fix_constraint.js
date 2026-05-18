const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../../src/config/database');

async function fix() {
  try {
    console.log('🔧 Fixing chk_question_type constraint...');

    // Drop old constraint if exists
    await db.query(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'chk_question_type'
              AND conrelid = 'questions'::regclass
          ) THEN
              ALTER TABLE questions DROP CONSTRAINT chk_question_type;
              RAISE NOTICE 'Dropped old constraint';
          ELSE
              RAISE NOTICE 'Constraint not found, skipping drop';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Drop skipped: %', SQLERRM;
      END $$;
    `);

    // Create new constraint with all types
    await db.query(`
      ALTER TABLE questions ADD CONSTRAINT chk_question_type
        CHECK (question_type IN (
          'single_choice',
          'fill_blank_pool',
          'fill_blank_item',
          'reading_passage',
          'reading_item',
          'true_false'
        ))
    `);

    // Verify
    const result = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conname = 'chk_question_type'
      AND conrelid = 'questions'::regclass
    `);

    console.log('Constraint created:', result.rows[0]);
    console.log('✅ Fix thanh cong!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
}

fix();
