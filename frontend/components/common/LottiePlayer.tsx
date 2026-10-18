'use client';

import { useEffect, useState } from 'react';
import Lottie, { LottieComponentProps } from 'lottie-react';

export default function LottiePlayer(props: LottieComponentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={props.className}
        style={props.style || { width: '100%', height: '100%' }}
      />
    );
  }

  return <Lottie {...props} />;
}
