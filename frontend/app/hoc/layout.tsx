import { CourseComingSoonGate } from '@/components/courses/CourseComingSoonGate';

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return <CourseComingSoonGate>{children}</CourseComingSoonGate>;
}
