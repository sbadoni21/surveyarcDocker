export default function RoleBadge({ role, scope }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-white">
      <span className="font-medium text-gray-800">{role}</span>
      <span className="text-gray-500">({scope})</span>
    </span>
  );
}
