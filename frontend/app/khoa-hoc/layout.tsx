import { CourseComingSoonGate } from '@/components/courses/CourseComingSoonGate';

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <CourseComingSoonGate>{children}</CourseComingSoonGate>;
}
