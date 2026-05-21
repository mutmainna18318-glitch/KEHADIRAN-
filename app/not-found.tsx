import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-slate-300 font-mono mb-4">404</h1>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Halaman Tidak Ditemukan</h2>
        <p className="text-slate-600 mb-6">Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.</p>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
