'use client';

interface StudentOnlyProps {
    children: React.ReactNode;
}

/**
 * Compatibility wrapper.
 * Route-level access control is handled directly in each page/module.
 */
export default function StudentOnly({ children }: StudentOnlyProps) {
    return <>{children}</>;
}
