import { notFound } from 'next/navigation';

// Unknown /app paths get the in-app "not found" page (app/app/not-found.tsx), inside the shell
export default function MissingAppPage() {
  notFound();
}
