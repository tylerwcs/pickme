import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-8 bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-800">PickMe</h1>
      <div className="flex gap-4">
        <Link 
          href="/admin" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
          Open Admin Panel
        </Link>
        <Link 
          href="/display" 
            target="_blank"
          className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition"
        >
          Open Display Page
        </Link>
        </div>
      <p className="text-gray-500">Open Display Page in a separate tab or window.</p>
      </main>
  );
}
