export const dynamic = 'force-dynamic';
import { IlluminatiAuth } from '@gitroom/frontend/components/auth/illuminati.auth';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: `Illuminati Login`,
  description: '',
};
export default async function Auth() {
  return <IlluminatiAuth />;
}
