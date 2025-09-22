// components/DashedEdge.jsx
import { BaseEdge, getBezierPath } from 'reactflow';

export default function DashedEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: data?.color || '#4caf50',
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }}
      />
      {data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            style={{
              fontSize: 12,
              fill: data?.color || '#4caf50',
            }}
            startOffset="50%"
            textAnchor="middle"
          >
            {data.label}
          </textPath>
        </text>
      )}
    </>
  );
}
