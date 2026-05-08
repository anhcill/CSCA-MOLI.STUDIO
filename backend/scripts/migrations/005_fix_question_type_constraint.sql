/**
 * Migration: 005_fix_question_type_constraint.sql
 * Purpose: Update chk_question_type constraint to include all question types
 *   used by the exam system (fill_blank_item, reading_item, reading_passage, etc.)
 */

-- Drop the old constraint if it exists, then recreate with all valid types
DO $$
BEGIN
    -- Only drop if it exists (avoid error)
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_question_type'
        AND conrelid = 'questions'::regclass
    ) THEN
        ALTER TABLE questions DROP CONSTRAINT chk_question_type;
        RAISE NOTICE 'Dropped old chk_question_type constraint';
    ELSE
        RAISE NOTICE 'chk_question_type constraint not found, will create from scratch';
    END IF;
END $$;

-- Recreate the constraint with ALL question types
ALTER TABLE questions ADD CONSTRAINT chk_question_type
    CHECK (question_type IN (
        'single_choice',
        'fill_blank_pool',
        'fill_blank_item',
        'reading_passage',
        'reading_item',
        'true_false'
    ));

-- Verify the constraint
DO $$
DECLARE
    con record;
BEGIN
    FOR con IN
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conname = 'chk_question_type'
        AND conrelid = 'questions'::regclass
    LOOP
        RAISE NOTICE 'Constraint: % - %', con.conname, con.def;
    END LOOP;
END $$;

-- Also check existing rows that might violate the new constraint
DO $$
DECLARE
    bad_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad_count
    FROM questions
    WHERE question_type NOT IN (
        'single_choice',
        'fill_blank_pool',
        'fill_blank_item',
        'reading_passage',
        'reading_item',
        'true_false'
    );

    IF bad_count > 0 THEN
        RAISE WARNING 'Found % rows with invalid question_type that will be blocked by the constraint', bad_count;
    ELSE
        RAISE NOTICE 'All existing rows are valid under the new constraint';
    END IF;
END $$;
