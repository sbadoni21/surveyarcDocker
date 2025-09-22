'use client';
import DashedEdge from '@/components/DashedEdge';
import React, { useEffect, useState } from 'react';
import { FaRoute } from 'react-icons/fa';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

const edgeTypes = {
  dashed: DashedEdge,
};

export default function QuestionFlowTab({ questions = [], rules = [] }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    console.log("🧾 Props - questions:", questions);
    console.log("🧾 Props - rules:", rules);

    if (!questions.length) return;

    const generatedNodes = questions.map((q, index) => ({
      id: q.id,
      data: { label: q.label || `Question ${index + 1}` },
      position: { x: 200, y: 100 + index * 150 },
    }));
    

    generatedNodes.unshift({
      id: 'start',
      type: 'input',
      data: { label: 'Start' },
      position: { x: 200, y: 0 },
    });

    generatedNodes.push({
      id: 'end',
      data: { label: 'End' },
      position: { x: 200, y: (questions.length + 1) * 150 },
    });

    const defaultEdges = questions.map((q, idx) => {
      const nextQ = questions[idx + 1];
      return nextQ
        ? {
            id: `e-${q.id}-to-${nextQ.id}`,
            source: q.id,
            target: nextQ.id,
            style: { stroke: '#bbb' },
          }
        : null;
    }).filter(Boolean);

    const startEdge = {
      id: 'e-start-to-first',
      source: 'start',
      target: questions[0].id,
      animated: true,
      style: { stroke: '#007bff' },
    };

    const ruleEdges = [];
    (rules || []).forEach((rule, rIdx) => {
      const conditions = rule.conditions || [];
      const sourceId = conditions[0]?.questionId || 'unknown';

      (rule.actions || []).forEach((action, aIdx) => {
        const type = action.type;
        console.log(action)
        const targets = Array.isArray(action.target)
          ? action.target
          : [action.target];
        targets.forEach((targetId, i) => {
          const edgeId = `rule-${rIdx}-${aIdx}-${i}`;
          const finalTarget = targetId === 'END' ? 'end' : targetId;

          ruleEdges.push({
            id: edgeId,
            source: sourceId,
            target: finalTarget,
            type: 'dashed',
            data: {
              label: rule.name,
              color: type === 'end' ? '#f44336' : '#4caf50',
            },
          });
        });
      });
    });

    const allEdges = [startEdge, ...defaultEdges, ...ruleEdges];

    setNodes(generatedNodes);
    setEdges(allEdges);

    console.log("🧱 Generated Nodes:", generatedNodes);
    console.log("🔗 Generated Edges:", allEdges);
  }, [questions, rules]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <FaRoute className="text-blue-600 w-6 h-6" />
        <h2 className="text-xl font-bold text-slate-800">Question Flow</h2>
      </div>
      {nodes.length ? (
        <div style={{ width: '100%', height: '600px' }}>
          <ReactFlow nodes={nodes} edges={edges} fitView edgeTypes={edgeTypes}>
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      ) : (
        <div className="text-slate-500 text-sm text-center py-8">
          No flow available. Add questions and logic rules to begin.
        </div>
      )}
    </div>
  );
}
