import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DefaultPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/website/1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
