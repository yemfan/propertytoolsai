import Link from "next/link";

export type PortalLink = { href: string; label: string; description?: string };

export default function RolePortalHub({
  eyebrow,
  title,
  description,
  links,
}: {
  eyebrow: string;
  title: string;
  description: string;
  links: PortalLink[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">{eyebrow}</p>
      <h1 className="mt-2 text-center font-heading text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-600">{description}</p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#0072ce]/40 hover:shadow-md"
            >
              <span className="font-semibold text-gray-900">{item.label}</span>
              {item.description ? (
                <span className="mt-1 block text-xs text-gray-600">{item.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
