import React from "react";
import { FileResponse } from "../../DocumentsContext";

interface KnowledgeCapacityProps {
  files: FileResponse[];
}

export const KnowledgeCapacity: React.FC<KnowledgeCapacityProps> = ({
  files,
}) => {
  // Mock data for demonstration
  const totalTokens = files.length * 1000; // Assume 1000 tokens per file
  const maxTokens = 10000; // Example max tokens for a model

  const percentUsed = (totalTokens / maxTokens) * 100;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">Knowledge Capacity</h2>
      <div className="bg-gray-200 h-4 rounded-full">
        <div
          className="bg-blue-500 h-4 rounded-full"
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span>{totalTokens.toLocaleString()} tokens used</span>
        <span>{maxTokens.toLocaleString()} tokens max</span>
      </div>
      {percentUsed > 100 && (
        <p className="text-red-500 mt-2">
          Warning: Content exceeds model capacity. Search will be performed over
          the content.
        </p>
      )}
    </div>
  );
};
