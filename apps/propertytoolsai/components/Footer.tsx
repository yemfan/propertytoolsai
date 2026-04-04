// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} PropertyTools AI. All rights reserved.
      </div>
    </footer>
  )
}
