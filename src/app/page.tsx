import { redirect } from 'next/navigation';

export default function Home() {
  // Always redirect to the login page from the root.
  // The login page will then handle redirecting to the dashboard if the user is already authenticated.
  redirect('/login');
}
