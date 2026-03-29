// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="bg-white shadow-inner mt-10">
      <div className="container mx-auto text-center p-4 text-gray-500">
        &copy; {new Date().getFullYear()} LeadSmart AI. All rights reserved.
      </div>
    </footer>
  )
}
