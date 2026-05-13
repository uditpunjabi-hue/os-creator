import { redirect } from 'next/navigation';

export default function LegalRedirect() {
  redirect('/manager/contracts');
}
